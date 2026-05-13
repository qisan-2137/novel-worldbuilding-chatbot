import { Hono } from 'hono'
import { z } from 'zod'

import type { ChatRequest, SettingsInput } from '../shared/types'
import {
  createMessage,
  createProject,
  createSession,
  ensureBootstrapState,
  getProjectById,
  getProjectContext,
  getSessionById,
  getSettings,
  listMessages,
  listOutlineNodes,
  listProjects,
  listRecentMessages,
  listSessions,
  listWorldbuildingEntries,
  retitleSessionFromPrompt,
  saveGeneratedOutlineNodes,
  saveGeneratedWorldbuildingEntries,
  saveSettings,
} from './db'
import { generateStructuredChatResult } from './openai'

type Bindings = {
  DB: D1Database
  ASSETS: Fetcher
}

const settingsSchema = z.object({
  baseUrl: z.string().url(),
  apiKey: z.string().min(1),
  model: z.string().min(1),
})

const createProjectSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(240).default(''),
})

const createSessionSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().max(80).optional(),
})

const chatSchema = z.object({
  projectId: z.string().min(1),
  sessionId: z.string().min(1),
  message: z.string().min(1).max(4000),
})

const app = new Hono<{ Bindings: Bindings }>()

function jsonError(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
  })
}

app.onError((error, c) => {
  const message = error instanceof Error ? error.message : 'Unknown error'
  if (c.req.path.startsWith('/api/')) {
    return jsonError(message, 500)
  }

  return new Response(message, { status: 500 })
})

app.get('/api/bootstrap', async (c) => {
  const bootstrap = await ensureBootstrapState(c.env.DB)
  return c.json(bootstrap)
})

app.get('/api/settings', async (c) => {
  const settings = await getSettings(c.env.DB)
  return c.json(settings)
})

app.put('/api/settings', async (c) => {
  const payload = settingsSchema.parse((await c.req.json()) satisfies SettingsInput)
  const settings = await saveSettings(c.env.DB, payload)
  return c.json(settings)
})

app.get('/api/projects', async (c) => {
  const projects = await listProjects(c.env.DB)
  return c.json({ projects })
})

app.post('/api/projects', async (c) => {
  const payload = createProjectSchema.parse(await c.req.json())
  const project = await createProject(c.env.DB, payload.name, payload.description)
  const session = await createSession(c.env.DB, project.id, '初始灵感会话')
  return c.json({ project, session }, 201)
})

app.get('/api/sessions', async (c) => {
  const projectId = c.req.query('projectId')

  if (!projectId) {
    return jsonError('缺少 projectId。')
  }

  const sessions = await listSessions(c.env.DB, projectId)
  return c.json({ sessions })
})

app.post('/api/sessions', async (c) => {
  const payload = createSessionSchema.parse(await c.req.json())
  const project = await getProjectById(c.env.DB, payload.projectId)

  if (!project) {
    return jsonError('项目不存在。', 404)
  }

  const session = await createSession(c.env.DB, payload.projectId, payload.title)
  return c.json({ session }, 201)
})

app.get('/api/sessions/:id/messages', async (c) => {
  const session = await getSessionById(c.env.DB, c.req.param('id'))

  if (!session) {
    return jsonError('会话不存在。', 404)
  }

  const messages = await listMessages(c.env.DB, session.id)
  return c.json({ session, messages })
})

app.get('/api/projects/:id/worldbuilding', async (c) => {
  const project = await getProjectById(c.env.DB, c.req.param('id'))

  if (!project) {
    return jsonError('项目不存在。', 404)
  }

  const worldbuildingEntries = await listWorldbuildingEntries(c.env.DB, project.id)
  return c.json({ worldbuildingEntries })
})

app.get('/api/projects/:id/outline', async (c) => {
  const project = await getProjectById(c.env.DB, c.req.param('id'))

  if (!project) {
    return jsonError('项目不存在。', 404)
  }

  const outlineNodes = await listOutlineNodes(c.env.DB, project.id)
  return c.json({ outlineNodes })
})

app.post('/api/chat', async (c) => {
  const payload = chatSchema.parse((await c.req.json()) satisfies ChatRequest)
  const [project, session, settings, history] = await Promise.all([
    getProjectById(c.env.DB, payload.projectId),
    getSessionById(c.env.DB, payload.sessionId),
    getSettings(c.env.DB),
    listRecentMessages(c.env.DB, payload.sessionId),
  ])

  if (!project) {
    return jsonError('项目不存在。', 404)
  }

  if (!session || session.projectId !== project.id) {
    return jsonError('会话不存在，或不属于当前项目。', 404)
  }

  const trimmedMessage = payload.message.trim()
  const userMessage = await createMessage(c.env.DB, session.id, 'user', trimmedMessage)
  const updatedSession = await retitleSessionFromPrompt(c.env.DB, session, trimmedMessage)
  const projectContext = await getProjectContext(c.env.DB, project.id)

  const generated = await generateStructuredChatResult(
    settings,
    {
      project,
      history,
      worldbuildingEntries: projectContext.worldbuildingEntries,
      outlineNodes: projectContext.outlineNodes,
    },
    trimmedMessage,
  )

  const assistantMessage = await createMessage(
    c.env.DB,
    session.id,
    'assistant',
    generated.reply,
  )

  const [worldbuildingEntries, outlineNodes] = await Promise.all([
    saveGeneratedWorldbuildingEntries(
      c.env.DB,
      project.id,
      session.id,
      assistantMessage.id,
      generated.worldbuildingEntries,
    ),
    saveGeneratedOutlineNodes(
      c.env.DB,
      project.id,
      session.id,
      assistantMessage.id,
      generated.outlineNodes,
    ),
  ])

  return c.json({
    session: updatedSession,
    userMessage,
    assistantMessage,
    worldbuildingEntries,
    outlineNodes,
  })
})

app.all('/api/*', () => jsonError('API route not found.', 404))
app.all('*', async (c) => c.env.ASSETS.fetch(c.req.raw))

export default app
