import { startTransition, useEffect, useState } from 'react'

import './App.css'
import {
  worldbuildingCategories,
  type BootstrapResponse,
  type ChatResponse,
  type Message,
  type OutlineKind,
  type OutlineNode,
  type Project,
  type Session,
  type SettingsInput,
  type WorldbuildingCategory,
  type WorldbuildingEntry,
} from './shared/types'

const defaultSettings: SettingsInput = {
  baseUrl: 'https://api.jzib.club/v1',
  apiKey: 'sk-fROELoFXYFtE0wzvy',
  model: 'gpt-5.4',
}

const promptIdeas = [
  '帮我设计一个帝国衰落期的魔法工业世界，先给世界背景、历史沿革和核心冲突。',
  '我想写一部带硬科幻气质的星际政治小说，请先梳理科技体系、地域势力和剧情大纲。',
  '请为一个修真与蒸汽机械并存的长篇小说设计科技体系、魔法体系和三幕式大纲。',
]

const outlineKindLabels: Record<OutlineKind, string> = {
  premise: 'Premise',
  act: '幕',
  chapter: '章节',
  beat: '情节节点',
  conflict: '冲突',
  arc: '角色弧光',
}

const categoryDescriptions: Record<WorldbuildingCategory, string> = {
  世界背景: '世界的整体气质、秩序和基础规则。',
  历史沿革: '重要历史节点、断裂点与时代转折。',
  地域势力: '国家、组织、派系与疆域关系。',
  角色阵营: '主要角色群体、阵营逻辑与利益结构。',
  科技体系: '技术边界、工业水平、成本与用途。',
  魔法体系: '施法方式、媒介、代价、限制与传承。',
  核心冲突: '驱动故事和世界变化的主要矛盾。',
  剧情大纲: '主线推进、事件序列与叙事结构。',
}

type AppView = 'workspace' | 'worldbuilding' | 'outline' | 'scenes' | 'inspiration' | 'chat'
type IconName =
  | 'chat'
  | 'outline'
  | 'library'
  | 'settings'
  | 'spark'
  | 'send'
  | 'scene'
  | 'idea'

function apiErrorMessage(text: string) {
  try {
    const parsed = JSON.parse(text) as { error?: string }
    return parsed.error || '请求失败。'
  } catch {
    return text || '请求失败。'
  }
}

function normalizeInitializationError(message: string) {
  if (message.includes('no such table: app_settings')) {
    return '本地 D1 数据库还没有执行 migration，缺少 app_settings 表。请在项目目录运行 npm run db:migrate:local 后再启动；我也已把 dev:api 改成会自动先执行本地 migration。'
  }

  return message || '初始化失败。'
}

async function apiFetch<T>(input: string, init?: RequestInit) {
  const response = await fetch(input, init)
  const text = await response.text()

  if (!response.ok) {
    throw new Error(apiErrorMessage(text))
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

function formatDateOnly(iso: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
  }).format(new Date(iso))
}

function getAppViewFromPath(pathname: string): AppView {
  if (pathname.startsWith('/chat')) {
    return 'chat'
  }

  if (pathname.startsWith('/scenes')) {
    return 'scenes'
  }

  if (pathname.startsWith('/inspiration')) {
    return 'inspiration'
  }

  if (pathname.startsWith('/worldbuilding')) {
    return 'worldbuilding'
  }

  if (pathname.startsWith('/outline')) {
    return 'outline'
  }

  return 'workspace'
}

function getPathForView(view: AppView) {
  if (view === 'chat') {
    return '/chat'
  }

  if (view === 'scenes') {
    return '/scenes'
  }

  if (view === 'inspiration') {
    return '/inspiration'
  }

  if (view === 'worldbuilding') {
    return '/worldbuilding'
  }

  if (view === 'outline') {
    return '/outline'
  }

  return '/'
}

function sortWorldbuildingEntries(entries: WorldbuildingEntry[]) {
  return [...entries].sort((left, right) => {
    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
  })
}

function sortOutlineNodes(nodes: OutlineNode[]) {
  return [...nodes].sort((left, right) => {
    if (left.position !== right.position) {
      return left.position - right.position
    }

    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
  })
}

function getSessionTitle(sessions: Session[], sessionId: string | null) {
  if (!sessionId) {
    return '未关联会话'
  }

  return sessions.find((session) => session.id === sessionId)?.title ?? '未找到来源会话'
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
  const [composerValue, setComposerValue] = useState('')
  const [chatPending, setChatPending] = useState(false)
  const [settingsPending, setSettingsPending] = useState(false)
  const [sessionPending, setSessionPending] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [currentView, setCurrentView] = useState<AppView>(() => {
    if (typeof window === 'undefined') {
      return 'workspace'
    }

    return getAppViewFromPath(window.location.pathname)
  })
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [summaryCollapsed, setSummaryCollapsed] = useState(false)

  useEffect(() => {
    void loadBootstrap()
  }, [])

  useEffect(() => {
    const handlePopState = () => {
      setCurrentView(getAppViewFromPath(window.location.pathname))
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
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
      const message = error instanceof Error ? error.message : '初始化失败。'
      setLoadError(normalizeInitializationError(message))
    } finally {
      setLoading(false)
    }
  }

  function navigateTo(view: AppView) {
    const nextPath = getPathForView(view)
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath)
    }

    setCurrentView(view)
  }

  async function openSession(sessionId: string) {
    setStatusMessage('')
    setSessionPending(true)

    try {
      const data = await apiFetch<{ session: Session; messages: Message[] }>(
        `/api/sessions/${sessionId}/messages`,
      )
      startTransition(() => {
        setActiveSession(data.session)
        setMessages(data.messages)
        navigateTo('workspace')
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
        navigateTo('workspace')
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
      setSettingsOpen(false)
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
    setSummaryCollapsed(false)

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
        navigateTo('workspace')
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
        <div className="feedback-card">
          <p className="section-kicker">Loading</p>
          <h1>正在加载创作工作台</h1>
          <p>正在同步项目、会话、设定条目和大纲节点。</p>
        </div>
      </div>
    )
  }

  if (loadError || !project || !activeSession) {
    return (
      <div className="app-shell loading-state">
        <div className="feedback-card">
          <p className="section-kicker">Error</p>
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
    <div className={`app-shell app-shell--${currentView}`}>
      {currentView === 'workspace' ? (
        <GlobalSidebar
          currentView={currentView}
          onOpenSettings={() => setSettingsOpen(true)}
          onNavigate={navigateTo}
        />
      ) : null}

      <div className="app-main">
        {statusMessage ? <div className="status-banner">{statusMessage}</div> : null}

        {currentView === 'workspace' ? (
          <div className={`workspace-grid ${summaryCollapsed ? 'workspace-grid--compact' : ''}`}>
            <SessionSidebar
              activeSessionId={activeSession.id}
              chatPending={chatPending}
              onCreateNewSession={() => void createNewSession()}
              onOpenSession={(sessionId) => void openSession(sessionId)}
              onPickPrompt={setComposerValue}
              project={project}
              promptIdeas={promptIdeas}
              sessionPending={sessionPending}
              sessions={sessions}
            />

            <WorkspacePanel
              activeSession={activeSession}
              chatPending={chatPending}
              composerValue={composerValue}
              messages={messages}
              onComposerChange={setComposerValue}
              onOpenSettings={() => setSettingsOpen(true)}
              onPickPrompt={setComposerValue}
              onShare={() => void shareCurrentPage(project.name)}
              onSendMessage={() => void sendMessage()}
              promptIdeas={promptIdeas}
            />

            <WorkspaceSummaryPanel
              activeSession={activeSession}
              collapsed={summaryCollapsed}
              onExpand={() => setSummaryCollapsed(false)}
              onGoToOutline={() => navigateTo('outline')}
              onGoToWorldbuilding={() => navigateTo('worldbuilding')}
              onToggleCollapse={() => setSummaryCollapsed((current) => !current)}
              outlineNodes={outlineNodes}
              worldbuildingEntries={worldbuildingEntries}
            />
          </div>
        ) : null}

        {currentView === 'worldbuilding' ? (
          <WorldbuildingLibraryView
            onBack={() => navigateTo('workspace')}
            sessions={sessions}
            settingsDraft={settingsDraft}
            setSettingsDraft={setSettingsDraft}
            settingsPending={settingsPending}
            onSaveSettings={() => void saveCurrentSettings()}
            worldbuildingEntries={worldbuildingEntries}
          />
        ) : null}

        {currentView === 'outline' ? (
          <OutlineStudioView
            onBack={() => navigateTo('workspace')}
            outlineNodes={outlineNodes}
            sessions={sessions}
          />
        ) : null}

        {currentView === 'scenes' ? (
          <CreativeScenesView
            onBack={() => navigateTo('workspace')}
            worldbuildingEntries={worldbuildingEntries}
          />
        ) : null}

        {currentView === 'inspiration' ? (
          <InspirationLibraryView
            onBack={() => navigateTo('workspace')}
            onNavigate={navigateTo}
            outlineNodes={outlineNodes}
            worldbuildingEntries={worldbuildingEntries}
          />
        ) : null}

        {currentView === 'chat' ? (
          <ChatDetailView
            activeSession={activeSession}
            chatPending={chatPending}
            composerValue={composerValue}
            messages={messages}
            onBack={() => navigateTo('workspace')}
            onComposerChange={setComposerValue}
            onOpenSettings={() => setSettingsOpen(true)}
            onShare={() => void shareCurrentPage(project.name)}
            onSendMessage={() => void sendMessage()}
          />
        ) : null}
      </div>

      <SettingsDrawer
        onClose={() => setSettingsOpen(false)}
        onSave={() => void saveCurrentSettings()}
        open={settingsOpen}
        pending={settingsPending}
        settingsDraft={settingsDraft}
        setSettingsDraft={setSettingsDraft}
      />
    </div>
  )
}

async function shareCurrentPage(title: string) {
  if (navigator.share) {
    await navigator.share({ title, url: window.location.href })
    return
  }

  await navigator.clipboard?.writeText(window.location.href)
}

function Icon({ name }: { name: IconName }) {
  if (name === 'chat') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 7.75A3.75 3.75 0 0 1 9.75 4h4.5A3.75 3.75 0 0 1 18 7.75v3.5A3.75 3.75 0 0 1 14.25 15H11l-4.4 3.2A.7.7 0 0 1 5.5 17.63V15.1A3.75 3.75 0 0 1 3 11.56V10.5" />
        <path d="M9 9h6M9 12h4" />
      </svg>
    )
  }

  if (name === 'outline') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6.75 4.5h10.5A1.75 1.75 0 0 1 19 6.25v11.5a1.75 1.75 0 0 1-1.75 1.75H6.75A1.75 1.75 0 0 1 5 17.75V6.25A1.75 1.75 0 0 1 6.75 4.5Z" />
        <path d="M8.5 8h7M8.5 11.5h7M8.5 15h4" />
      </svg>
    )
  }

  if (name === 'library') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6.5 5.25h8.25A2.75 2.75 0 0 1 17.5 8v10.75H8.75A2.75 2.75 0 0 1 6 16V5.75a.5.5 0 0 1 .5-.5Z" />
        <path d="M9 8.5h5M9 12h5M17.5 8.25h.75A1.75 1.75 0 0 1 20 10v9H8.75" />
      </svg>
    )
  }

  if (name === 'settings') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 8.25A3.75 3.75 0 1 1 12 15.75A3.75 3.75 0 0 1 12 8.25Z" />
        <path d="M18.5 12a6.6 6.6 0 0 0-.12-1.25l2.02-1.56-2-3.46-2.39.96a6.9 6.9 0 0 0-2.15-1.25L13.5 3h-4l-.36 2.44a6.9 6.9 0 0 0-2.15 1.25L4.6 5.73l-2 3.46 2.02 1.56a6.6 6.6 0 0 0 0 2.5L2.6 14.81l2 3.46 2.39-.96a6.9 6.9 0 0 0 2.15 1.25L9.5 21h4l.36-2.44a6.9 6.9 0 0 0 2.15-1.25l2.39.96 2-3.46-2.02-1.56c.08-.4.12-.82.12-1.25Z" />
      </svg>
    )
  }

  if (name === 'send') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m5 12.5 13.8-7.2-3.3 13.4-3.2-5.1L5 12.5Z" />
        <path d="m12.3 13.6 6.5-8.3" />
      </svg>
    )
  }

  if (name === 'scene') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4.75 6.75A2.25 2.25 0 0 1 7 4.5h10a2.25 2.25 0 0 1 2.25 2.25v10A2.25 2.25 0 0 1 17 19H7a2.25 2.25 0 0 1-2.25-2.25v-10Z" />
        <path d="m6.5 16 3.1-3.4 2.3 2.2 2.9-4.1 2.7 5.3" />
        <path d="M9.5 8.4h.01" />
      </svg>
    )
  }

  if (name === 'idea') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9 18.5h6" />
        <path d="M9.75 21h4.5" />
        <path d="M7.4 13.4A6.25 6.25 0 1 1 16.6 13.4c-1.08.9-1.6 1.84-1.6 2.85H9c0-1.01-.52-1.95-1.6-2.85Z" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m12 3 1.45 5.05L18.5 9.5l-5.05 1.45L12 16l-1.45-5.05L5.5 9.5l5.05-1.45L12 3Z" />
      <path d="m18 14 .8 2.7 2.7.8-2.7.8L18 21l-.8-2.7-2.7-.8 2.7-.8L18 14Z" />
    </svg>
  )
}

type GlobalSidebarProps = {
  currentView: AppView
  onNavigate: (view: AppView) => void
  onOpenSettings: () => void
}

function GlobalSidebar({ currentView, onNavigate, onOpenSettings }: GlobalSidebarProps) {
  const navItems: Array<{ icon: IconName; label: string; view: AppView }> = [
    { icon: 'chat', label: '会话', view: 'workspace' },
    { icon: 'outline', label: '文档', view: 'outline' },
    { icon: 'library', label: '世界观库', view: 'worldbuilding' },
    { icon: 'idea', label: '素材库', view: 'inspiration' },
  ]

  return (
    <aside className="global-sidebar" aria-label="全局导航">
      <div className="app-mark" aria-hidden="true">
        <Icon name="spark" />
      </div>

      <nav className="global-nav">
        {navItems.map((item) => (
          <button
            key={item.label}
            type="button"
            className={currentView === item.view ? 'global-nav-item active' : 'global-nav-item'}
            onClick={() => onNavigate(item.view)}
          >
            <Icon name={item.icon} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <button type="button" className="global-nav-item settings-entry" onClick={onOpenSettings}>
        <Icon name="settings" />
        <span>设置</span>
      </button>
    </aside>
  )
}

type SessionSidebarProps = {
  activeSessionId: string
  chatPending: boolean
  onCreateNewSession: () => void
  onOpenSession: (sessionId: string) => void
  onPickPrompt: (prompt: string) => void
  project: Project
  promptIdeas: string[]
  sessionPending: boolean
  sessions: Session[]
}

function SessionSidebar({
  activeSessionId,
  chatPending,
  onCreateNewSession,
  onOpenSession,
  onPickPrompt,
  project,
  promptIdeas,
  sessionPending,
  sessions,
}: SessionSidebarProps) {
  const todaySessions = sessions.slice(0, 4)
  const olderSessions = sessions.slice(4)

  return (
    <aside className="session-sidebar">
      <div className="session-brand-row">
        <div>
          <h1>{project.name}</h1>
          <p>{project.description || '围绕同一部小说的世界观、灵感与设定'}</p>
        </div>
        <span>⌄</span>
      </div>

      <div className="session-tools">
        <span aria-hidden="true">⌕</span>
        <span aria-hidden="true">↕</span>
      </div>

      <div className="new-session-wrap">
        <button
          type="button"
          className="new-session-button"
          onClick={onCreateNewSession}
          disabled={sessionPending}
        >
          {sessionPending ? '创建中...' : '+ 新建会话'}
        </button>
      </div>

      <div className="session-list">
        <span className="session-group-label">今天</span>
        {todaySessions.map((session) => (
          <button
            key={session.id}
            type="button"
            className={session.id === activeSessionId ? 'session-card active' : 'session-card'}
            onClick={() => onOpenSession(session.id)}
            disabled={sessionPending || chatPending}
          >
            <span className="session-icon">☁</span>
            <strong>{session.title}</strong>
            <time>{formatDateTime(session.updatedAt).split(' ').slice(-1)[0]}</time>
          </button>
        ))}
        {olderSessions.length ? <span className="session-group-label">更早</span> : null}
        {olderSessions.map((session) => (
          <button
            key={session.id}
            type="button"
            className={session.id === activeSessionId ? 'session-card active' : 'session-card'}
            onClick={() => onOpenSession(session.id)}
            disabled={sessionPending || chatPending}
          >
            <span className="session-icon">☁</span>
            <strong>{session.title}</strong>
            <time>{formatDateOnly(session.updatedAt)}</time>
          </button>
        ))}
      </div>

      <div className="sidebar-hints" hidden>
        <div className="idea-list">
          {promptIdeas.map((idea) => (
            <button
              key={idea}
              type="button"
              className="idea-chip"
              onClick={() => onPickPrompt(idea)}
            >
              {idea}
            </button>
          ))}
        </div>
      </div>

      <button type="button" className="trash-button">
        回收站
      </button>
    </aside>
  )
}

type WorkspacePanelProps = {
  activeSession: Session
  chatPending: boolean
  composerValue: string
  messages: Message[]
  onComposerChange: (value: string) => void
  onOpenSettings: () => void
  onPickPrompt: (prompt: string) => void
  onShare: () => void
  onSendMessage: () => void
  promptIdeas: string[]
}

function WorkspacePanel({
  activeSession,
  chatPending,
  composerValue,
  messages,
  onComposerChange,
  onOpenSettings,
  onPickPrompt,
  onShare,
  onSendMessage,
  promptIdeas,
}: WorkspacePanelProps) {
  return (
    <main className="workspace-panel">
      <header className="workspace-heading">
        <h2>{activeSession.title}</h2>
        <div className="action-row">
          <button type="button" className="secondary-button" onClick={onShare}>
            分享
          </button>
          <button type="button" className="secondary-button" onClick={onOpenSettings}>
            更多
          </button>
        </div>
      </header>

      <div className="message-stream">
        {messages.length ? (
          messages.map((message) => (
            <article
              key={message.id}
              className={message.role === 'user' ? 'message-card user' : 'message-card assistant'}
            >
              <div className="message-avatar" aria-hidden="true">
                <Icon name={message.role === 'user' ? 'chat' : 'spark'} />
              </div>
              <div className="message-body">
                <div className="message-meta">
                  <strong>{message.role === 'user' ? '你' : 'AI 助手'}</strong>
                  <span>{formatDateTime(message.createdAt)}</span>
                </div>
                <p>{message.content}</p>
                {message.role === 'assistant' ? (
                  <div className="message-actions" aria-hidden="true">
                    <span>□</span>
                    <span>↻</span>
                    <span>♡</span>
                    <span>♧</span>
                  </div>
                ) : null}
              </div>
            </article>
          ))
        ) : (
          <section className="empty-workspace">
            <p className="section-kicker">从明确的创作目标开始</p>
            <h2>先搭出世界，再把世界压成结构化设定。</h2>
            <p className="subtle">
              工作台只负责当前创作。世界观库和大纲页负责后续整理，这样主线会更清楚。
            </p>
            <div className="prompt-grid">
              {promptIdeas.map((idea) => (
                <button
                  key={idea}
                  type="button"
                  className="prompt-card"
                  onClick={() => onPickPrompt(idea)}
                >
                  {idea}
                </button>
              ))}
            </div>
          </section>
        )}
      </div>

      <div className="composer-shell">
        <textarea
          value={composerValue}
          onChange={(event) => onComposerChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              onSendMessage()
            }
          }}
          placeholder="输入你的问题或想法，Enter 发送，Shift + Enter 换行"
          rows={3}
          disabled={chatPending}
        />

        <div className="composer-actions">
          <div className="composer-icons" aria-hidden="true">
            <span>＋</span>
            <span>◎</span>
            <span>⌘</span>
          </div>
          <button
            type="button"
            className="primary-button send-button"
            onClick={onSendMessage}
            disabled={chatPending || !composerValue.trim()}
          >
            <Icon name="send" />
          </button>
        </div>
      </div>
    </main>
  )
}

type WorkspaceSummaryPanelProps = {
  activeSession: Session
  collapsed: boolean
  onExpand: () => void
  onGoToOutline: () => void
  onGoToWorldbuilding: () => void
  onToggleCollapse: () => void
  outlineNodes: OutlineNode[]
  worldbuildingEntries: WorldbuildingEntry[]
}

function WorkspaceSummaryPanel({
  activeSession,
  collapsed,
  onExpand,
  onGoToOutline,
  onGoToWorldbuilding,
  onToggleCollapse,
  outlineNodes,
  worldbuildingEntries,
}: WorkspaceSummaryPanelProps) {
  const sessionEntries = sortWorldbuildingEntries(
    worldbuildingEntries.filter((entry) => entry.sessionId === activeSession.id),
  ).slice(0, 4)
  const sessionOutlineNodes = sortOutlineNodes(
    outlineNodes.filter((node) => node.sessionId === activeSession.id),
  ).slice(0, 4)
  const recentEntryByCategory = worldbuildingCategories.map((category) => {
    const matchingEntry = sortWorldbuildingEntries(
      worldbuildingEntries.filter((entry) => entry.category === category),
    )[0]

    return {
      category,
      matchingEntry,
    }
  })

  if (collapsed) {
    return (
      <button type="button" className="summary-rail" onClick={onExpand}>
        展开整理面板
      </button>
    )
  }

  return (
    <aside className="panel summary-panel">
      <div className="panel-header">
        <div>
          <p className="section-kicker">Summary</p>
          <h2>整理结果</h2>
        </div>
        <button type="button" className="ghost-button" onClick={onToggleCollapse}>
          收起
        </button>
      </div>

      <section className="summary-section">
        <div className="summary-section-head">
          <div>
            <h3>本轮新增</h3>
            <p>先看当前会话刚刚沉淀了什么。</p>
          </div>
        </div>

        <div className="summary-subsection">
          <strong>世界观条目</strong>
          {sessionEntries.length ? (
            sessionEntries.map((entry) => (
              <article key={entry.id} className="summary-card">
                <span className="mini-label">{entry.category}</span>
                <strong>{entry.title}</strong>
                <p>{entry.summary}</p>
              </article>
            ))
          ) : (
            <p className="empty-copy">当前会话还没有新增设定条目。</p>
          )}
        </div>

        <div className="summary-subsection">
          <strong>大纲节点</strong>
          {sessionOutlineNodes.length ? (
            sessionOutlineNodes.map((node) => (
              <article key={node.id} className="summary-card">
                <span className="mini-label">{outlineKindLabels[node.kind]}</span>
                <strong>{node.title}</strong>
                <p>{node.summary}</p>
              </article>
            ))
          ) : (
            <p className="empty-copy">当前会话还没有新增大纲节点。</p>
          )}
        </div>
      </section>

      <section className="summary-section">
        <div className="summary-section-head">
          <div>
            <h3>世界观概览</h3>
            <p>按分类快速回看全局设定。</p>
          </div>
          <button type="button" className="ghost-button" onClick={onGoToWorldbuilding}>
            打开世界观库
          </button>
        </div>

        <div className="category-overview-list">
          {recentEntryByCategory.map(({ category, matchingEntry }) => (
            <article key={category} className="category-overview-card">
              <div>
                <strong>{category}</strong>
                <p>{categoryDescriptions[category]}</p>
              </div>
              <span>{matchingEntry ? matchingEntry.title : '暂缺'}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="summary-section">
        <div className="summary-section-head">
          <div>
            <h3>大纲概览</h3>
            <p>把聊天草稿压缩成结构化推进。</p>
          </div>
          <button type="button" className="ghost-button" onClick={onGoToOutline}>
            打开大纲页
          </button>
        </div>

        <div className="outline-mini-list">
          {sortOutlineNodes(outlineNodes)
            .slice(0, 6)
            .map((node) => (
              <article key={node.id} className="outline-mini-card">
                <div className="outline-mini-meta">
                  <span>{outlineKindLabels[node.kind]}</span>
                  <span>#{node.position}</span>
                </div>
                <strong>{node.title}</strong>
              </article>
            ))}
        </div>
      </section>
    </aside>
  )
}

type WorldbuildingLibraryViewProps = {
  onBack: () => void
  onSaveSettings: () => void
  sessions: Session[]
  setSettingsDraft: React.Dispatch<React.SetStateAction<SettingsInput>>
  settingsDraft: SettingsInput
  settingsPending: boolean
  worldbuildingEntries: WorldbuildingEntry[]
}

function WorldbuildingLibraryView({
  onBack,
  onSaveSettings,
  sessions,
  setSettingsDraft,
  settingsDraft,
  settingsPending,
  worldbuildingEntries,
}: WorldbuildingLibraryViewProps) {
  const [categoryFilter, setCategoryFilter] = useState<WorldbuildingCategory>(
    worldbuildingEntries[0]?.category ?? '世界背景',
  )
  const [tab, setTab] = useState<'world' | 'outline' | 'settings'>('world')

  const filteredEntries = sortWorldbuildingEntries(
    worldbuildingEntries.filter((entry) => {
      return entry.category === categoryFilter
    }),
  )

  const activeEntry = filteredEntries[0] ?? null
  const pageMenu = worldbuildingCategories.map((category) => ({
    category,
    count: worldbuildingEntries.filter((entry) => entry.category === category).length,
  }))

  return (
    <div className="reference-page worldbook-page">
      <header className="reference-header">
        <div>
          <button type="button" className="back-button" onClick={onBack} aria-label="返回会话">
            ←
          </button>
          <h2>设置与大纲</h2>
        </div>
        <p className="page-copy">世界书页、大纲和模型设置被拆成清晰层级。</p>
      </header>

      <div className="tabs-row">
        <button type="button" className={tab === 'world' ? 'tab active' : 'tab'} onClick={() => setTab('world')}>
          世界观
        </button>
        <button type="button" className={tab === 'outline' ? 'tab active' : 'tab'} onClick={() => setTab('outline')}>
          大纲
        </button>
        <button type="button" className={tab === 'settings' ? 'tab active' : 'tab'} onClick={() => setTab('settings')}>
          设置
        </button>
      </div>

      {tab === 'world' ? (
        <div className="worldbook-layout">
          <aside className="worldbook-sidebar">
            <h3>世界书页</h3>
            <div className="worldbook-menu">
              {pageMenu.map(({ category, count }) => (
                <button
                  key={category}
                  type="button"
                  className={
                    categoryFilter === category ? 'worldbook-page-link active' : 'worldbook-page-link'
                  }
                  onClick={() => setCategoryFilter(category)}
                >
                  <span className="worldbook-page-icon" aria-hidden="true">
                    {getWorldbookIcon(category)}
                  </span>
                  <span>{category}</span>
                  {count ? <small>{count}</small> : null}
                </button>
              ))}
            </div>
            <button type="button" className="secondary-button wide-button">
              + 新建书页
            </button>
          </aside>

          <main className="worldbook-detail">
            {activeEntry ? (
              <>
                <div className="detail-titlebar">
                  <div>
                    <span className="mini-label">{activeEntry.category}</span>
                    <h2>{activeEntry.title}</h2>
                  </div>
                  <button type="button" className="secondary-button">
                    编辑
                  </button>
                </div>
                <p className="lead-copy">{activeEntry.summary}</p>
                <div className="article-copy">
                  <p>{activeEntry.details}</p>
                  <p>
                    这个页面用于承载稳定设定，左侧负责切换世界书页，右侧负责阅读和编辑当前条目。
                    所有条目均来自真实 AI 对话整理结果，并保存在 D1。
                  </p>
                </div>
                <div className="detail-footer">
                  <span>最后更新：{formatDateTime(activeEntry.updatedAt)}</span>
                  <button type="button" className="secondary-button">
                    历史版本
                  </button>
                </div>
              </>
            ) : (
              <div className="empty-panel">
                <h3>{categoryFilter}还没有书页</h3>
                <p>回到会话页发送一次真实 AI 对话后，这里会展示 D1 中沉淀出的设定。</p>
              </div>
            )}
          </main>
        </div>
      ) : null}

      {tab === 'outline' ? (
        <div className="settings-outline-panel">
          <h2>大纲同步状态</h2>
          <p className="lead-copy">当前世界观条目会与大纲节点保持关联，便于从设定跳回剧情推进。</p>
          <div className="prototype-list">
            {filteredEntries.slice(0, 5).map((entry) => (
              <article key={entry.id} className="prototype-list-item">
                <span className="mini-label">{entry.category}</span>
                <strong>{entry.title}</strong>
                <p>{getSessionTitle(sessions, entry.sessionId)}</p>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {tab === 'settings' ? (
        <div className="settings-outline-panel">
          <h2>模型设置</h2>
          <p className="lead-copy">配置保存到 D1，下一次真实对话会直接使用这些参数。</p>
          <div className="settings-form inline-settings">
            <label>
              <span>Base URL</span>
              <input
                value={settingsDraft.baseUrl}
                onChange={(event) =>
                  setSettingsDraft((current) => ({ ...current, baseUrl: event.target.value }))
                }
              />
            </label>
            <label>
              <span>API Key</span>
              <input
                value={settingsDraft.apiKey}
                onChange={(event) =>
                  setSettingsDraft((current) => ({ ...current, apiKey: event.target.value }))
                }
              />
            </label>
            <label>
              <span>Model</span>
              <input
                value={settingsDraft.model}
                onChange={(event) =>
                  setSettingsDraft((current) => ({ ...current, model: event.target.value }))
                }
              />
            </label>
            <button
              type="button"
              className="primary-button"
              onClick={onSaveSettings}
              disabled={settingsPending}
            >
              {settingsPending ? '保存中...' : '保存 API 配置'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function getWorldbookIcon(category: WorldbuildingCategory) {
  const icons: Record<WorldbuildingCategory, string> = {
    世界背景: '▣',
    历史沿革: '◷',
    地域势力: '△',
    角色阵营: '♙',
    科技体系: '□',
    魔法体系: '✣',
    核心冲突: '⚖',
    剧情大纲: '☰',
  }

  return icons[category]
}

type OutlineStudioViewProps = {
  onBack: () => void
  outlineNodes: OutlineNode[]
  sessions: Session[]
}

function OutlineStudioView({ onBack, outlineNodes, sessions }: OutlineStudioViewProps) {
  const [selectedNodeId, setSelectedNodeId] = useState('')

  const filteredNodes = sortOutlineNodes(outlineNodes)

  const activeNode =
    filteredNodes.find((node) => node.id === selectedNodeId) ?? filteredNodes[0] ?? null

  return (
    <div className="reference-page outline-reference-page">
      <header className="reference-header">
        <div>
          <button type="button" className="back-button" onClick={onBack} aria-label="返回会话">
            ←
          </button>
          <h2>大纲</h2>
        </div>
        <button type="button" className="secondary-button">
          + 新建章节
        </button>
      </header>

      <div className="outline-layout">
        <aside className="chapter-sidebar">
          <span className="tiny-label">章节列表</span>
          <div className="chapter-list">
            {filteredNodes.length ? (
              filteredNodes.map((node) => (
                <button
                  key={node.id}
                  type="button"
                  className={activeNode?.id === node.id ? 'chapter-item active' : 'chapter-item'}
                  onClick={() => setSelectedNodeId(node.id)}
                >
                  <span className="chapter-doc-icon" aria-hidden="true">
                    ▤
                  </span>
                  <span>{getChapterTitle(node)}</span>
                  <span aria-hidden="true">•••</span>
                </button>
              ))
            ) : (
              <div className="empty-panel">
                <h3>还没有章节</h3>
                <p>先回到创作工作台生成剧情大纲节点。</p>
              </div>
            )}
          </div>
          <button type="button" className="chapter-create-button">
            + 新建章节
          </button>
        </aside>

        <section className="chapter-list-panel">
          <div className="node-list-head">
            <span className="tiny-label">节点列表</span>
            <span className="tiny-label">⌯ 筛选</span>
          </div>
          <div className="prototype-list">
            {filteredNodes.length ? (
              filteredNodes.map((node) => (
                <button
                  key={node.id}
                  type="button"
                  className={activeNode?.id === node.id ? 'entry-card active' : 'entry-card'}
                  onClick={() => setSelectedNodeId(node.id)}
                >
                  <span className="drag-handle" aria-hidden="true">
                    ⠿
                  </span>
                  <div className="entry-card-meta">
                    <span className="mini-label">{outlineKindLabels[node.kind]}</span>
                    <span>#{node.position}</span>
                  </div>
                  <strong>{node.title}</strong>
                  <p>{node.summary}</p>
                </button>
              ))
            ) : (
              <div className="empty-panel">
                <h3>当前还没有这类节点</h3>
                <p>先回到创作工作台生成剧情推进，再来这里整理结构。</p>
              </div>
            )}
          </div>
        </section>

        <main className="chapter-detail-panel">
          {activeNode ? (
            <>
              <h2>{activeNode.title}</h2>
              <div className="article-copy">
                <h3>核心内容</h3>
                <p>{activeNode.summary}</p>
                <h3>关键节点</h3>
                <p>• {outlineKindLabels[activeNode.kind]}</p>
                <p>• 来源会话：{getSessionTitle(sessions, activeNode.sessionId)}</p>
                <p>• 节点序号：#{activeNode.position}</p>
              </div>
              <button type="button" className="secondary-button">
                编辑大纲
              </button>
            </>
          ) : (
            <div className="empty-panel">
              <h3>先选择一个节点</h3>
              <p>详情面板应该只聚焦一个推进单元，而不是把所有大纲直接堆在首页右侧。</p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

function getChapterTitle(node: OutlineNode) {
  if (node.kind === 'act') {
    return node.title
  }

  if (node.kind === 'chapter') {
    return node.title
  }

  return `${outlineKindLabels[node.kind]} ${node.title}`
}

type CreativeScenesViewProps = {
  onBack: () => void
  worldbuildingEntries: WorldbuildingEntry[]
}

function CreativeScenesView({ onBack, worldbuildingEntries }: CreativeScenesViewProps) {
  const scenes = sortWorldbuildingEntries(
    worldbuildingEntries.filter((entry) =>
      ['世界背景', '地域势力', '历史沿革', '角色阵营'].includes(entry.category),
    ),
  )
  const [selectedSceneId, setSelectedSceneId] = useState(scenes[0]?.id ?? '')
  const activeScene = scenes.find((scene) => scene.id === selectedSceneId) ?? scenes[0] ?? null

  return (
    <div className="reference-page scenes-page">
      <header className="reference-header">
        <div>
          <button type="button" className="back-button" onClick={onBack} aria-label="返回会话">
            ←
          </button>
          <h2>创作场景</h2>
        </div>
        <button type="button" className="secondary-button">
          + 新增场景
        </button>
      </header>

      <div className="scene-layout">
        <aside className="chapter-sidebar">
          <span className="tiny-label">场景列表</span>
          <div className="filter-list">
            {scenes.length ? (
              scenes.slice(0, 6).map((scene) => (
                <button
                  key={scene.id}
                  type="button"
                  className={activeScene?.id === scene.id ? 'scene-card active' : 'scene-card'}
                  onClick={() => setSelectedSceneId(scene.id)}
                >
                  <span className="scene-thumb" aria-hidden="true" />
                  <span className="scene-card-title">{scene.title}</span>
                  <span className="scene-card-check" aria-hidden="true">
                    ✓
                  </span>
                </button>
              ))
            ) : (
              <div className="empty-panel scene-empty-panel">
                <h3>还没有可整理的场景</h3>
                <p>先回到会话页生成世界背景、地域势力、历史沿革或角色阵营条目。</p>
              </div>
            )}
          </div>
        </aside>

        <main className="scene-detail-panel">
          {activeScene ? (
            <>
              <div className="scene-visual" aria-hidden="true">
                <div className="floating-island island-one" />
                <div className="floating-island island-two" />
                <div className="floating-island island-three" />
              </div>
              <h2>{activeScene.title}</h2>
              <p className="lead-copy">{activeScene.summary}</p>
              <div>
                <span className="tiny-label">关联设定</span>
                <div className="tag-row">
                  <span className="mini-label">{activeScene.category}</span>
                  <span className="mini-label">来源：真实 AI 对话</span>
                </div>
              </div>
              <button type="button" className="secondary-button scene-edit-button">
                编辑场景
              </button>
            </>
          ) : (
            <div className="empty-panel scene-empty-panel">
              <h3>场景面板等待真实内容</h3>
              <p>这里不会展示预设场景。完成一次真实 AI 对话后，D1 中的设定会出现在这里。</p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

type InspirationLibraryViewProps = {
  onBack: () => void
  onNavigate: (view: AppView) => void
  outlineNodes: OutlineNode[]
  worldbuildingEntries: WorldbuildingEntry[]
}

function InspirationLibraryView({
  onBack,
  onNavigate,
  outlineNodes,
  worldbuildingEntries,
}: InspirationLibraryViewProps) {
  const [query, setQuery] = useState('')
  const inspirations = [
    ...sortWorldbuildingEntries(worldbuildingEntries).slice(0, 4).map((entry) => ({
      id: entry.id,
      label: entry.category,
      title: entry.title,
      subtitle: entry.summary,
      time: formatDateOnly(entry.updatedAt),
    })),
    ...sortOutlineNodes(outlineNodes).slice(0, 3).map((node) => ({
      id: node.id,
      label: outlineKindLabels[node.kind],
      title: node.title,
      subtitle: node.summary,
      time: `#${node.position}`,
    })),
  ]
  const normalizedQuery = query.trim().toLowerCase()
  const visibleInspirations = inspirations.filter((item) =>
    `${item.label} ${item.title} ${item.subtitle}`.toLowerCase().includes(normalizedQuery),
  )
  const railItems = [
    { icon: '□', label: '对话', view: 'workspace' as AppView },
    { icon: '◎', label: '世界观', view: 'worldbuilding' as AppView },
    { icon: '♙', label: '角色' },
    { icon: '♢', label: '灵感库' },
    { icon: '▤', label: '笔记' },
    { icon: '⌁', label: '时间线' },
    { icon: '▣', label: '设定集', view: 'worldbuilding' as AppView },
  ]

  return (
    <div className="inspiration-shell">
      <aside className="inspiration-rail">
        <div className="rail-mark">羽</div>
        <nav>
          {railItems.map((item) =>
            item.view ? (
              <button key={item.label} type="button" onClick={() => onNavigate(item.view)}>
                <span aria-hidden="true">{item.icon}</span>
                {item.label}
              </button>
            ) : (
              <span key={item.label} className={item.label === '灵感库' ? 'active' : ''}>
                <span aria-hidden="true">{item.icon}</span>
                {item.label}
              </span>
            ),
          )}
        </nav>
        <div className="rail-bottom">
          <span>⌫ 回收站</span>
          <span>⚙ 设置</span>
        </div>
      </aside>
      <div className="reference-page inspiration-page">
        <header className="reference-header">
          <div>
            <button type="button" className="back-button" onClick={onBack} aria-label="返回会话">
              ←
            </button>
            <h2>灵感库</h2>
          </div>
        </header>

        <div className="inspiration-toolbar">
          <input
            className="search-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索灵感关键词"
          />
          <button type="button" className="secondary-button">
            全部类型
          </button>
        </div>

        <div className="inspiration-list">
          {visibleInspirations.length ? (
            visibleInspirations.map((item, index) => (
              <article key={item.id} className="inspiration-item">
                <span className="inspiration-icon" aria-hidden="true">
                  {['♧', '◎', '♢', '⚖'][index % 4]}
                </span>
                <div>
                  <strong>{item.title}</strong>
                  <p>
                    <span>{item.label}</span>
                    <span>{item.subtitle}</span>
                  </p>
                </div>
                <time>{item.time}</time>
              </article>
            ))
          ) : (
            <div className="empty-panel inspiration-empty-panel">
              <h3>还没有灵感素材</h3>
              <p>完成一次真实 AI 对话后，世界观条目和大纲节点会自动进入灵感库。</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

type ChatDetailViewProps = {
  activeSession: Session
  chatPending: boolean
  composerValue: string
  messages: Message[]
  onBack: () => void
  onComposerChange: (value: string) => void
  onOpenSettings: () => void
  onShare: () => void
  onSendMessage: () => void
}

function ChatDetailView({
  activeSession,
  chatPending,
  composerValue,
  messages,
  onBack,
  onComposerChange,
  onOpenSettings,
  onShare,
  onSendMessage,
}: ChatDetailViewProps) {
  const lastUserMessage = [...messages].reverse().find((message) => message.role === 'user')
  const lastAssistantMessage = [...messages].reverse().find((message) => message.role === 'assistant')

  return (
    <div className="reference-page chat-detail-page">
      <header className="reference-header">
        <div>
          <button type="button" className="back-button" onClick={onBack} aria-label="返回会话">
            ←
          </button>
          <h2>{activeSession.title}</h2>
        </div>
        <div className="action-row">
          <button type="button" className="secondary-button" onClick={onShare}>
            分享
          </button>
          <button type="button" className="secondary-button" onClick={onOpenSettings}>
            更多
          </button>
        </div>
      </header>

      <div className="chat-detail-stream">
        {lastUserMessage ? <div className="user-bubble">{lastUserMessage.content}</div> : null}

        {lastAssistantMessage ? (
          <article className="assistant-answer-card">
            <div className="message-avatar" aria-hidden="true">
              <Icon name="spark" />
            </div>
            <div>
              <p>AI 助手</p>
              <section className="answer-inner-card">
                <h3>真实模型回复</h3>
                <p>{lastAssistantMessage.content}</p>
              </section>
              <div className="scroll-cue">↓</div>
            </div>
          </article>
        ) : (
          <div className="empty-panel chat-empty-panel">
            <h3>还没有真实 AI 回复</h3>
            <p>在底部输入问题并发送，页面会调用配置的 OpenAI-compatible API。</p>
          </div>
        )}
      </div>

      <div className="chat-detail-composer">
        <input
          value={composerValue}
          onChange={(event) => onComposerChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              onSendMessage()
            }
          }}
          placeholder="请输入你的问题，Shift + Enter 换行"
          disabled={chatPending}
        />
        <button
          type="button"
          className="primary-button square-send"
          onClick={onSendMessage}
          disabled={chatPending || !composerValue.trim()}
        >
          <Icon name="send" />
        </button>
      </div>
    </div>
  )
}

type SettingsDrawerProps = {
  onClose: () => void
  onSave: () => void
  open: boolean
  pending: boolean
  setSettingsDraft: React.Dispatch<React.SetStateAction<SettingsInput>>
  settingsDraft: SettingsInput
}

function SettingsDrawer({
  onClose,
  onSave,
  open,
  pending,
  setSettingsDraft,
  settingsDraft,
}: SettingsDrawerProps) {
  return (
    <div className={open ? 'settings-overlay open' : 'settings-overlay'} aria-hidden={!open}>
      <button type="button" className="settings-backdrop" onClick={onClose} aria-label="关闭设置" />
      <aside className={open ? 'settings-drawer open' : 'settings-drawer'}>
        <div className="panel-header">
          <div>
            <p className="section-kicker">Settings</p>
            <h2>模型配置</h2>
            <p className="subtle">设置被收进抽屉，不再和世界观、大纲共享同一块主内容区域。</p>
          </div>
          <button type="button" className="ghost-button" onClick={onClose}>
            关闭
          </button>
        </div>

        <div className="settings-form">
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

          <div className="settings-note-card">
            <p>当前配置保存在 D1，下一次对话立即生效。</p>
            <p>这里不会使用预设回复或假聊天；如果上游失败，会直接返回真实错误。</p>
          </div>

          <button type="button" className="primary-button primary-button--wide" onClick={onSave} disabled={pending}>
            {pending ? '保存中...' : '保存 API 配置'}
          </button>
        </div>
      </aside>
    </div>
  )
}

export default App
