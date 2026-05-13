import { z } from 'zod'

import { outlineKinds, worldbuildingCategories } from '../shared/types'
import type { Message, Project } from '../shared/types'
import type { GeneratedOutlineNode, GeneratedWorldbuildingEntry } from './db'

const aiResponseSchema = z.object({
  reply: z.string().min(1),
  worldbuilding_entries: z
    .array(
      z.object({
        category: z.enum(worldbuildingCategories),
        title: z.string().min(1),
        summary: z.string().min(1),
        details: z.string().min(1),
      }),
    )
    .max(12)
    .default([]),
  outline_nodes: z
    .array(
      z.object({
        kind: z.enum(outlineKinds),
        title: z.string().min(1),
        summary: z.string().min(1),
      }),
    )
    .max(12)
    .default([]),
})

export interface ChatCompletionSettings {
  baseUrl: string
  apiKey: string
  model: string
}

export interface ProjectContext {
  project: Project
  history: Message[]
  worldbuildingEntries: GeneratedWorldbuildingEntry[]
  outlineNodes: GeneratedOutlineNode[]
}

export interface StructuredChatResult {
  reply: string
  worldbuildingEntries: GeneratedWorldbuildingEntry[]
  outlineNodes: GeneratedOutlineNode[]
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
}

function extractTextContent(content: unknown): string {
  if (typeof content === 'string') {
    return content.trim()
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') {
          return part
        }

        if (
          part &&
          typeof part === 'object' &&
          'type' in part &&
          'text' in part &&
          part.type === 'text' &&
          typeof part.text === 'string'
        ) {
          return part.text
        }

        return ''
      })
      .join('\n')
      .trim()
  }

  return ''
}

function extractJsonBlock(content: string) {
  const withoutFences = content.replace(/```json|```/gi, '').trim()

  if (withoutFences.startsWith('{') && withoutFences.endsWith('}')) {
    return withoutFences
  }

  const start = withoutFences.indexOf('{')
  const end = withoutFences.lastIndexOf('}')

  if (start >= 0 && end > start) {
    return withoutFences.slice(start, end + 1)
  }

  throw new Error('模型返回内容中没有可解析的 JSON。')
}

function buildSystemPrompt(context: ProjectContext) {
  return [
    '你是一名专门服务小说作者的世界观与大纲协作助手。',
    '你的目标是帮助作者生成清晰、合理、可持续扩展的世界观设定，并整理为结构化条目。',
    '始终优先保证设定自洽、冲突可解释、层级清楚。',
    '你必须只输出一个 JSON 对象，不要输出 JSON 之外的任何文字。',
    '',
    'JSON 结构要求：',
    '{',
    '  "reply": "给作者的中文回复，可用简洁 Markdown，包含建议、判断和下一步方向",',
    '  "worldbuilding_entries": [',
    '    {',
    `      "category": "必须是以下之一：${worldbuildingCategories.join('、')}",`,
    '      "title": "条目标题",',
    '      "summary": "一句话摘要",',
    '      "details": "2-5 句具体设定，避免空话"',
    '    }',
    '  ],',
    '  "outline_nodes": [',
    '    {',
    `      "kind": "必须是以下之一：${outlineKinds.join('、')}",`,
    '      "title": "大纲节点标题",',
    '      "summary": "节点摘要，描述事件、冲突或推进作用"',
    '    }',
    '  ]',
    '}',
    '',
    '输出规则：',
    '1. reply 必须自然、具体、直接面向作者。',
    '2. 只有在内容值得保存时才写入 worldbuilding_entries 和 outline_nodes；没有就返回空数组。',
    '3. 不要重复已有设定，除非你是在精炼或修正它。',
    '4. 科技体系与魔法体系要有层级、边界、代价或限制。',
    '5. 核心冲突与剧情大纲要体现推动关系，而不是散点灵感。',
    '6. 如果用户的问题不足以直接展开，请在 reply 里明确指出还缺哪些前提，并给一个合理的初版方案。',
    '',
    `当前项目：${context.project.name}`,
    `项目简介：${context.project.description || '暂无简介'}`,
    '',
    '已有世界观条目：',
    JSON.stringify(context.worldbuildingEntries, null, 2),
    '',
    '已有大纲节点：',
    JSON.stringify(context.outlineNodes, null, 2),
  ].join('\n')
}

export async function generateStructuredChatResult(
  settings: ChatCompletionSettings,
  context: ProjectContext,
  userMessage: string,
) {
  const endpoint = new URL('chat/completions', normalizeBaseUrl(settings.baseUrl))
  const upstreamResponse = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model,
      temperature: 0.8,
      messages: [
        {
          role: 'system',
          content: buildSystemPrompt(context),
        },
        ...context.history.map((message) => ({
          role: message.role,
          content: message.content,
        })),
        {
          role: 'user',
          content: userMessage,
        },
      ],
    }),
  })

  const responseText = await upstreamResponse.text()

  if (!upstreamResponse.ok) {
    throw new Error(
      `上游模型调用失败（${upstreamResponse.status}）：${responseText.slice(0, 600)}`,
    )
  }

  let payload: unknown

  try {
    payload = JSON.parse(responseText)
  } catch (error) {
    throw new Error(`上游返回了非 JSON 内容：${responseText.slice(0, 600)}`, {
      cause: error,
    })
  }

  const content = extractTextContent(
    (payload as { choices?: Array<{ message?: { content?: unknown } }> }).choices?.[0]
      ?.message?.content,
  )

  if (!content) {
    throw new Error('模型返回为空，无法继续。')
  }

  let parsed: unknown

  try {
    parsed = JSON.parse(extractJsonBlock(content))
  } catch (error) {
    const reason = error instanceof Error ? error.message : '未知错误'
    throw new Error(`模型返回的结构化内容无法解析：${reason}`, {
      cause: error,
    })
  }

  const result = aiResponseSchema.parse(parsed)

  return {
    reply: result.reply.trim(),
    worldbuildingEntries: result.worldbuilding_entries.map((entry) => ({
      category: entry.category,
      title: entry.title.trim(),
      summary: entry.summary.trim(),
      details: entry.details.trim(),
    })),
    outlineNodes: result.outline_nodes.map((node) => ({
      kind: node.kind,
      title: node.title.trim(),
      summary: node.summary.trim(),
    })),
  } satisfies StructuredChatResult
}
