import { startTransition, useEffect, useState } from 'react'

import './App.css'
import {
  worldbuildingCategories,
  type BootstrapResponse,
  type ChatResponse,
  type Message,
  type OutlineNode,
  type Project,
  type Session,
  type SettingsInput,
  type WorldbuildingEntry,
} from './shared/types'

const defaultSettings: SettingsInput = {
  baseUrl: 'https://api.jzib.club/v1',
  apiKey: 'sk-fROELoFXYFtE0wzvy',
  model: 'gpt-5.4',
}

const promptIdeas = [
  '帮我设计一个“帝国衰落期的魔法工业世界”，先给世界背景、历史沿革和核心冲突。',
  '我想写一部带硬科幻气质的星际政治小说，请先梳理科技体系、地域势力和剧情大纲。',
  '请为一个“修真与蒸汽机械并存”的长篇小说设计科技体系、魔法体系和三幕式大纲。',
]

type InspectorTab = 'worldbuilding' | 'outline' | 'settings'

async function apiFetch<T>(input: string, init?: RequestInit) {
  const response = await fetch(input, init)
  const text = await response.text()

  if (!response.ok) {
    try {
      const parsed = JSON.parse(text) as { error?: string }
      throw new Error(parsed.error || '请求失败。')
    } catch {
      throw new Error(text || '请求失败。')
    }
  }

  if (!text) {
    return {} as T
  }

  return JSON.parse(text) as T
}

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

function App() {
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [project, setProject] = useState<Project | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [activeSession, setActiveSession] = useState<Session | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [worldbuildingEntries, setWorldbuildingEntries] = useState<WorldbuildingEntry[]>(
    [],
  )
  const [outlineNodes, setOutlineNodes] = useState<OutlineNode[]>([])
  const [settingsDraft, setSettingsDraft] = useState<SettingsInput>(defaultSettings)
  const [selectedTab, setSelectedTab] = useState<InspectorTab>('worldbuilding')
  const [composerValue, setComposerValue] = useState('')
  const [chatPending, setChatPending] = useState(false)
  const [settingsPending, setSettingsPending] = useState(false)
  const [sessionPending, setSessionPending] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')

  useEffect(() => {
    void loadBootstrap()
  }, [])

  async function loadBootstrap() {
    setLoading(true)
    setLoadError('')

    try {
      const data = await apiFetch<BootstrapResponse>('/api/bootstrap')
      startTransition(() => {
        setProject(data.project)
        setSessions(data.sessions)
        setActiveSession(data.activeSession)
        setMessages(data.messages)
        setWorldbuildingEntries(data.worldbuildingEntries)
        setOutlineNodes(data.outlineNodes)
        setSettingsDraft({
          baseUrl: data.settings.baseUrl,
          apiKey: data.settings.apiKey,
          model: data.settings.model,
        })
      })
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : '初始化失败。')
    } finally {
      setLoading(false)
    }
  }

  async function openSession(sessionId: string) {
    if (!project) {
      return
    }

    setStatusMessage('')
    setSessionPending(true)

    try {
      const data = await apiFetch<{ session: Session; messages: Message[] }>(
        `/api/sessions/${sessionId}/messages`,
      )
      startTransition(() => {
        setActiveSession(data.session)
        setMessages(data.messages)
      })
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : '加载会话失败。')
    } finally {
      setSessionPending(false)
    }
  }

  async function createNewSession() {
    if (!project) {
      return
    }

    setSessionPending(true)
    setStatusMessage('')

    try {
      const data = await apiFetch<{ session: Session }>('/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId: project.id,
          title: `创作会话 ${sessions.length + 1}`,
        }),
      })

      startTransition(() => {
        setSessions((current) => [data.session, ...current])
        setActiveSession(data.session)
        setMessages([])
      })
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : '创建会话失败。')
    } finally {
      setSessionPending(false)
    }
  }

  async function saveCurrentSettings() {
    setSettingsPending(true)
    setStatusMessage('')

    try {
      const updated = await apiFetch<SettingsInput>('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settingsDraft),
      })

      setSettingsDraft(updated)
      setStatusMessage('API 配置已保存到 D1。')
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : '保存设置失败。')
    } finally {
      setSettingsPending(false)
    }
  }

  async function sendMessage() {
    if (!project || !activeSession || chatPending) {
      return
    }

    const trimmedMessage = composerValue.trim()
    if (!trimmedMessage) {
      return
    }

    const optimisticId = `optimistic-${Date.now()}`
    const optimisticMessage: Message = {
      id: optimisticId,
      sessionId: activeSession.id,
      role: 'user',
      content: trimmedMessage,
      createdAt: new Date().toISOString(),
    }

    setChatPending(true)
    setStatusMessage('')
    setComposerValue('')
    setMessages((current) => [...current, optimisticMessage])

    try {
      const response = await apiFetch<ChatResponse>('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId: project.id,
          sessionId: activeSession.id,
          message: trimmedMessage,
        }),
      })

      startTransition(() => {
        setActiveSession(response.session)
        setSessions((current) => [
          response.session,
          ...current.filter((session) => session.id !== response.session.id),
        ])
        setMessages((current) => [
          ...current.filter((message) => message.id !== optimisticId),
          response.userMessage,
          response.assistantMessage,
        ])
        setWorldbuildingEntries(response.worldbuildingEntries)
        setOutlineNodes(response.outlineNodes)
        if (response.worldbuildingEntries.length) {
          setSelectedTab('worldbuilding')
        } else if (response.outlineNodes.length) {
          setSelectedTab('outline')
        }
      })
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : '发送失败。')
      setMessages((current) => current.filter((message) => message.id !== optimisticId))
      await openSession(activeSession.id)
    } finally {
      setChatPending(false)
    }
  }

  if (loading) {
    return (
      <div className="app-shell loading-state">
        <p>正在加载创作工作台...</p>
      </div>
    )
  }

  if (loadError || !project || !activeSession) {
    return (
      <div className="app-shell loading-state">
        <div className="error-card">
          <h1>初始化失败</h1>
          <p>{loadError || '项目上下文未能加载。'}</p>
          <button type="button" className="primary-button" onClick={() => void loadBootstrap()}>
            重新加载
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Novel Worldbuilding Chatbot</p>
          <h1>{project.name}</h1>
          <p className="subtle">{project.description}</p>
        </div>
        <div className="topbar-meta">
          <span>{sessions.length} 个会话</span>
          <span>{worldbuildingEntries.length} 条设定</span>
          <span>{outlineNodes.length} 个大纲节点</span>
        </div>
      </header>

      {statusMessage ? <div className="status-banner">{statusMessage}</div> : null}

      <div className="workspace">
        <aside className="panel sidebar">
          <div className="panel-header">
            <div>
              <p className="section-kicker">会话</p>
              <h2>创作场景</h2>
            </div>
            <button
              type="button"
              className="secondary-button"
              onClick={() => void createNewSession()}
              disabled={sessionPending}
            >
              {sessionPending ? '处理中...' : '新建会话'}
            </button>
          </div>

          <div className="session-list">
            {sessions.map((session) => (
              <button
                key={session.id}
                type="button"
                className={`session-card ${session.id === activeSession.id ? 'active' : ''}`}
                onClick={() => void openSession(session.id)}
                disabled={sessionPending || chatPending}
              >
                <strong>{session.title}</strong>
                <span>{formatDateTime(session.updatedAt)}</span>
              </button>
            ))}
          </div>

          <div className="panel-block">
            <p className="section-kicker">灵感起手式</p>
            <div className="idea-list">
              {promptIdeas.map((idea) => (
                <button
                  key={idea}
                  type="button"
                  className="idea-chip"
                  onClick={() => setComposerValue(idea)}
                >
                  {idea}
                </button>
              ))}
            </div>
          </div>
        </aside>

        <main className="panel chat-panel">
          <div className="panel-header">
            <div>
              <p className="section-kicker">真实对话</p>
              <h2>{activeSession.title}</h2>
            </div>
            <span className="subtle">
              每次回复都会同步整理世界观条目和大纲节点。
            </span>
          </div>

          <div className="message-stream">
            {messages.length ? (
              messages.map((message) => (
                <article key={message.id} className={`message-card ${message.role}`}>
                  <div className="message-meta">
                    <strong>{message.role === 'user' ? '作者' : 'AI 助手'}</strong>
                    <span>{formatDateTime(message.createdAt)}</span>
                  </div>
                  <p>{message.content}</p>
                </article>
              ))
            ) : (
              <section className="empty-state">
                <p className="section-kicker">从一个明确的创作目标开始</p>
                <h2>先让它搭出世界，再把世界压成条目和大纲。</h2>
                <p className="subtle">
                  这里不会返回预设内容。每次发送都会真实调用模型，并把可保存的设定写入 D1。
                </p>
              </section>
            )}
          </div>

          <div className="composer">
            <textarea
              value={composerValue}
              onChange={(event) => setComposerValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  void sendMessage()
                }
              }}
              placeholder="例如：帮我设计一个拥有贵族血脉魔法和铁路工业革命并存的世界，并整理科技体系、魔法体系和核心冲突。"
              rows={6}
              disabled={chatPending}
            />
            <div className="composer-actions">
              <span className="subtle">Enter 发送，Shift + Enter 换行</span>
              <button
                type="button"
                className="primary-button"
                onClick={() => void sendMessage()}
                disabled={chatPending || !composerValue.trim()}
              >
                {chatPending ? '生成中...' : '发送并整理设定'}
              </button>
            </div>
          </div>
        </main>

        <aside className="panel inspector">
          <div className="panel-header">
            <div>
              <p className="section-kicker">整理结果</p>
              <h2>设定与大纲</h2>
            </div>
          </div>

          <div className="tab-row">
            <button
              type="button"
              className={selectedTab === 'worldbuilding' ? 'active' : ''}
              onClick={() => setSelectedTab('worldbuilding')}
            >
              世界观
            </button>
            <button
              type="button"
              className={selectedTab === 'outline' ? 'active' : ''}
              onClick={() => setSelectedTab('outline')}
            >
              大纲
            </button>
            <button
              type="button"
              className={selectedTab === 'settings' ? 'active' : ''}
              onClick={() => setSelectedTab('settings')}
            >
              设置
            </button>
          </div>

          {selectedTab === 'worldbuilding' ? (
            <div className="inspector-body">
              {worldbuildingCategories.map((category) => {
                const items = worldbuildingEntries.filter((entry) => entry.category === category)

                return (
                  <section key={category} className="category-section">
                    <div className="category-heading">
                      <h3>{category}</h3>
                      <span>{items.length}</span>
                    </div>
                    {items.length ? (
                      items.map((entry) => (
                        <article key={entry.id} className="detail-card">
                          <strong>{entry.title}</strong>
                          <p className="detail-summary">{entry.summary}</p>
                          <p>{entry.details}</p>
                        </article>
                      ))
                    ) : (
                      <p className="empty-copy">当前还没有这类设定条目。</p>
                    )}
                  </section>
                )
              })}
            </div>
          ) : null}

          {selectedTab === 'outline' ? (
            <div className="inspector-body">
              {outlineNodes.length ? (
                outlineNodes.map((node) => (
                  <article key={node.id} className="detail-card outline-card">
                    <div className="outline-meta">
                      <span>{node.kind}</span>
                      <span>#{node.position}</span>
                    </div>
                    <strong>{node.title}</strong>
                    <p>{node.summary}</p>
                  </article>
                ))
              ) : (
                <p className="empty-copy">
                  还没有可保存的大纲节点。先让它围绕幕结构、章节推进或关键冲突做一轮设计。
                </p>
              )}
            </div>
          ) : null}

          {selectedTab === 'settings' ? (
            <div className="inspector-body settings-form">
              <label>
                <span>Base URL</span>
                <input
                  value={settingsDraft.baseUrl}
                  onChange={(event) =>
                    setSettingsDraft((current) => ({
                      ...current,
                      baseUrl: event.target.value,
                    }))
                  }
                  placeholder="https://api.jzib.club/v1"
                />
              </label>
              <label>
                <span>API Key</span>
                <input
                  value={settingsDraft.apiKey}
                  onChange={(event) =>
                    setSettingsDraft((current) => ({
                      ...current,
                      apiKey: event.target.value,
                    }))
                  }
                  placeholder="sk-..."
                />
              </label>
              <label>
                <span>Model</span>
                <input
                  value={settingsDraft.model}
                  onChange={(event) =>
                    setSettingsDraft((current) => ({
                      ...current,
                      model: event.target.value,
                    }))
                  }
                  placeholder="gpt-5.4"
                />
              </label>
              <div className="settings-notes">
                <p>当前配置保存在 D1，修改后下一次对话立即生效。</p>
                <p>这里不会使用预设回复或假聊天；如果上游调用失败，会直接返回真实错误。</p>
              </div>
              <button
                type="button"
                className="primary-button"
                onClick={() => void saveCurrentSettings()}
                disabled={settingsPending}
              >
                {settingsPending ? '保存中...' : '保存 API 配置'}
              </button>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  )
}

export default App
