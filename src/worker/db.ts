import type {
  AppSettings,
  BootstrapResponse,
  Message,
  OutlineKind,
  OutlineNode,
  Project,
  Session,
  SettingsInput,
  WorldbuildingCategory,
  WorldbuildingEntry,
} from '../shared/types'

const DEFAULT_SETTINGS = {
  baseUrl: 'https://api.jzib.club/v1',
  apiKey: 'sk-fROELoFXYFtE0wzvy',
  model: 'gpt-5.4',
}

const DEFAULT_PROJECT_NAME = '默认小说企划'
const DEFAULT_PROJECT_DESCRIPTION = '围绕同一部小说持续整理世界观条目和剧情大纲。'
const DEFAULT_SESSION_TITLE = '初始灵感会话'

interface SettingsRow {
  base_url: string
  api_key: string
  model: string
  updated_at: string
}

interface ProjectRow {
  id: string
  name: string
  description: string
  created_at: string
  updated_at: string
}

interface SessionRow {
  id: string
  project_id: string
  title: string
  created_at: string
  updated_at: string
}

interface MessageRow {
  id: string
  session_id: string
  role: string
  content: string
  created_at: string
}

interface WorldbuildingRow {
  id: string
  project_id: string
  session_id: string | null
  category: WorldbuildingCategory
  title: string
  summary: string
  details: string
  created_at: string
  updated_at: string
}

interface OutlineRow {
  id: string
  project_id: string
  session_id: string | null
  kind: OutlineKind
  title: string
  summary: string
  position: number
  created_at: string
  updated_at: string
}

export interface GeneratedWorldbuildingEntry {
  category: WorldbuildingCategory
  title: string
  summary: string
  details: string
}

export interface GeneratedOutlineNode {
  kind: OutlineKind
  title: string
  summary: string
}

function nowIso() {
  return new Date().toISOString()
}

function createId() {
  return crypto.randomUUID()
}

function toSettings(row: SettingsRow): AppSettings {
  return {
    baseUrl: row.base_url,
    apiKey: row.api_key,
    model: row.model,
    updatedAt: row.updated_at,
  }
}

function toProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toSession(row: SessionRow): Session {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toMessage(row: MessageRow): Message {
  return {
    id: row.id,
    sessionId: row.session_id,
    role: row.role as Message['role'],
    content: row.content,
    createdAt: row.created_at,
  }
}

function toWorldbuildingEntry(row: WorldbuildingRow): WorldbuildingEntry {
  return {
    id: row.id,
    projectId: row.project_id,
    sessionId: row.session_id,
    category: row.category,
    title: row.title,
    summary: row.summary,
    details: row.details,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toOutlineNode(row: OutlineRow): OutlineNode {
  return {
    id: row.id,
    projectId: row.project_id,
    sessionId: row.session_id,
    kind: row.kind,
    title: row.title,
    summary: row.summary,
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function trimSessionTitle(input: string) {
  return input.replace(/\s+/g, ' ').trim().slice(0, 32) || DEFAULT_SESSION_TITLE
}

export function getDefaultSettings(): SettingsInput {
  return { ...DEFAULT_SETTINGS }
}

export async function getSettings(db: D1Database) {
  const existing = await db
    .prepare(
      `
        SELECT base_url, api_key, model, updated_at
        FROM app_settings
        WHERE id = 1
      `,
    )
    .first<SettingsRow>()

  if (existing) {
    return toSettings(existing)
  }

  const updatedAt = nowIso()
  await db
    .prepare(
      `
        INSERT INTO app_settings (id, base_url, api_key, model, updated_at)
        VALUES (1, ?, ?, ?, ?)
      `,
    )
    .bind(
      DEFAULT_SETTINGS.baseUrl,
      DEFAULT_SETTINGS.apiKey,
      DEFAULT_SETTINGS.model,
      updatedAt,
    )
    .run()

  return {
    ...DEFAULT_SETTINGS,
    updatedAt,
  }
}

export async function saveSettings(db: D1Database, input: SettingsInput) {
  const updatedAt = nowIso()
  await db
    .prepare(
      `
        INSERT INTO app_settings (id, base_url, api_key, model, updated_at)
        VALUES (1, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          base_url = excluded.base_url,
          api_key = excluded.api_key,
          model = excluded.model,
          updated_at = excluded.updated_at
      `,
    )
    .bind(input.baseUrl, input.apiKey, input.model, updatedAt)
    .run()

  return {
    ...input,
    updatedAt,
  }
}

export async function listProjects(db: D1Database) {
  const result = await db
    .prepare(
      `
        SELECT id, name, description, created_at, updated_at
        FROM projects
        ORDER BY updated_at DESC, created_at DESC
      `,
    )
    .all<ProjectRow>()

  return result.results.map(toProject)
}

export async function createProject(
  db: D1Database,
  name: string,
  description = '',
) {
  const id = createId()
  const timestamp = nowIso()

  await db
    .prepare(
      `
        INSERT INTO projects (id, name, description, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `,
    )
    .bind(id, name.trim(), description.trim(), timestamp, timestamp)
    .run()

  return {
    id,
    name: name.trim(),
    description: description.trim(),
    createdAt: timestamp,
    updatedAt: timestamp,
  } satisfies Project
}

export async function getProjectById(db: D1Database, projectId: string) {
  const row = await db
    .prepare(
      `
        SELECT id, name, description, created_at, updated_at
        FROM projects
        WHERE id = ?
      `,
    )
    .bind(projectId)
    .first<ProjectRow>()

  return row ? toProject(row) : null
}

export async function touchProject(db: D1Database, projectId: string) {
  await db
    .prepare(
      `
        UPDATE projects
        SET updated_at = ?
        WHERE id = ?
      `,
    )
    .bind(nowIso(), projectId)
    .run()
}

export async function listSessions(db: D1Database, projectId: string) {
  const result = await db
    .prepare(
      `
        SELECT id, project_id, title, created_at, updated_at
        FROM sessions
        WHERE project_id = ?
        ORDER BY updated_at DESC, created_at DESC
      `,
    )
    .bind(projectId)
    .all<SessionRow>()

  return result.results.map(toSession)
}

export async function getSessionById(db: D1Database, sessionId: string) {
  const row = await db
    .prepare(
      `
        SELECT id, project_id, title, created_at, updated_at
        FROM sessions
        WHERE id = ?
      `,
    )
    .bind(sessionId)
    .first<SessionRow>()

  return row ? toSession(row) : null
}

export async function createSession(
  db: D1Database,
  projectId: string,
  title?: string,
) {
  const id = createId()
  const timestamp = nowIso()
  const resolvedTitle = trimSessionTitle(title ?? DEFAULT_SESSION_TITLE)

  await db
    .prepare(
      `
        INSERT INTO sessions (id, project_id, title, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `,
    )
    .bind(id, projectId, resolvedTitle, timestamp, timestamp)
    .run()

  await touchProject(db, projectId)

  return {
    id,
    projectId,
    title: resolvedTitle,
    createdAt: timestamp,
    updatedAt: timestamp,
  } satisfies Session
}

export async function retitleSessionFromPrompt(
  db: D1Database,
  session: Session,
  prompt: string,
) {
  const currentTitle = session.title.trim()
  if (currentTitle !== DEFAULT_SESSION_TITLE && !currentTitle.startsWith('创作会话')) {
    return session
  }

  const nextTitle = trimSessionTitle(prompt)
  const updatedAt = nowIso()

  await db
    .prepare(
      `
        UPDATE sessions
        SET title = ?, updated_at = ?
        WHERE id = ?
      `,
    )
    .bind(nextTitle, updatedAt, session.id)
    .run()

  return {
    ...session,
    title: nextTitle,
    updatedAt,
  }
}

export async function touchSession(db: D1Database, sessionId: string) {
  await db
    .prepare(
      `
        UPDATE sessions
        SET updated_at = ?
        WHERE id = ?
      `,
    )
    .bind(nowIso(), sessionId)
    .run()
}

export async function listMessages(db: D1Database, sessionId: string) {
  const result = await db
    .prepare(
      `
        SELECT id, session_id, role, content, created_at
        FROM messages
        WHERE session_id = ?
        ORDER BY created_at ASC
      `,
    )
    .bind(sessionId)
    .all<MessageRow>()

  return result.results.map(toMessage)
}

export async function listRecentMessages(
  db: D1Database,
  sessionId: string,
  limit = 18,
) {
  const result = await db
    .prepare(
      `
        SELECT id, session_id, role, content, created_at
        FROM messages
        WHERE session_id = ?
        ORDER BY created_at DESC
        LIMIT ?
      `,
    )
    .bind(sessionId, limit)
    .all<MessageRow>()

  return result.results.reverse().map(toMessage)
}

export async function createMessage(
  db: D1Database,
  sessionId: string,
  role: Message['role'],
  content: string,
) {
  const id = createId()
  const createdAt = nowIso()

  await db
    .prepare(
      `
        INSERT INTO messages (id, session_id, role, content, created_at)
        VALUES (?, ?, ?, ?, ?)
      `,
    )
    .bind(id, sessionId, role, content.trim(), createdAt)
    .run()

  await touchSession(db, sessionId)

  return {
    id,
    sessionId,
    role,
    content: content.trim(),
    createdAt,
  } satisfies Message
}

export async function listWorldbuildingEntries(db: D1Database, projectId: string) {
  const result = await db
    .prepare(
      `
        SELECT id, project_id, session_id, category, title, summary, details, created_at, updated_at
        FROM worldbuilding_entries
        WHERE project_id = ?
        ORDER BY category ASC, updated_at DESC, title COLLATE NOCASE ASC
      `,
    )
    .bind(projectId)
    .all<WorldbuildingRow>()

  return result.results.map(toWorldbuildingEntry)
}

export async function listOutlineNodes(db: D1Database, projectId: string) {
  const result = await db
    .prepare(
      `
        SELECT id, project_id, session_id, kind, title, summary, position, created_at, updated_at
        FROM outline_nodes
        WHERE project_id = ?
        ORDER BY position ASC, updated_at DESC
      `,
    )
    .bind(projectId)
    .all<OutlineRow>()

  return result.results.map(toOutlineNode)
}

export async function saveGeneratedWorldbuildingEntries(
  db: D1Database,
  projectId: string,
  sessionId: string,
  sourceMessageId: string,
  entries: GeneratedWorldbuildingEntry[],
) {
  if (!entries.length) {
    return listWorldbuildingEntries(db, projectId)
  }

  const timestamp = nowIso()
  const statements = entries.map((entry) =>
    db
      .prepare(
        `
          INSERT INTO worldbuilding_entries (
            id,
            project_id,
            session_id,
            category,
            title,
            summary,
            details,
            source_message_id,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(project_id, category, title) DO UPDATE SET
            session_id = excluded.session_id,
            summary = excluded.summary,
            details = excluded.details,
            source_message_id = excluded.source_message_id,
            updated_at = excluded.updated_at
        `,
      )
      .bind(
        createId(),
        projectId,
        sessionId,
        entry.category,
        entry.title.trim(),
        entry.summary.trim(),
        entry.details.trim(),
        sourceMessageId,
        timestamp,
        timestamp,
      ),
  )

  await db.batch(statements)
  await touchProject(db, projectId)

  return listWorldbuildingEntries(db, projectId)
}

export async function saveGeneratedOutlineNodes(
  db: D1Database,
  projectId: string,
  sessionId: string,
  sourceMessageId: string,
  nodes: GeneratedOutlineNode[],
) {
  if (!nodes.length) {
    return listOutlineNodes(db, projectId)
  }

  const currentMaxPositionRow = await db
    .prepare(
      `
        SELECT COALESCE(MAX(position), 0) AS max_position
        FROM outline_nodes
        WHERE project_id = ?
      `,
    )
    .bind(projectId)
    .first<{ max_position: number }>()

  const startPosition = currentMaxPositionRow?.max_position ?? 0
  const timestamp = nowIso()

  const statements = nodes.map((node, index) =>
    db
      .prepare(
        `
          INSERT INTO outline_nodes (
            id,
            project_id,
            session_id,
            kind,
            title,
            summary,
            position,
            source_message_id,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(project_id, kind, title) DO UPDATE SET
            session_id = excluded.session_id,
            summary = excluded.summary,
            source_message_id = excluded.source_message_id,
            updated_at = excluded.updated_at
        `,
      )
      .bind(
        createId(),
        projectId,
        sessionId,
        node.kind,
        node.title.trim(),
        node.summary.trim(),
        startPosition + index + 1,
        sourceMessageId,
        timestamp,
        timestamp,
      ),
  )

  await db.batch(statements)
  await touchProject(db, projectId)

  return listOutlineNodes(db, projectId)
}

export async function getProjectContext(db: D1Database, projectId: string) {
  const [worldbuildingEntries, outlineNodes] = await Promise.all([
    listWorldbuildingEntries(db, projectId),
    listOutlineNodes(db, projectId),
  ])

  return {
    worldbuildingEntries: worldbuildingEntries.slice(0, 40),
    outlineNodes: outlineNodes.slice(0, 40),
  }
}

export async function ensureBootstrapState(db: D1Database): Promise<BootstrapResponse> {
  const settings = await getSettings(db)
  let projects = await listProjects(db)

  if (!projects.length) {
    const project = await createProject(
      db,
      DEFAULT_PROJECT_NAME,
      DEFAULT_PROJECT_DESCRIPTION,
    )
    await createSession(db, project.id, DEFAULT_SESSION_TITLE)
    projects = [project]
  }

  const project = projects[0]
  let sessions = await listSessions(db, project.id)

  if (!sessions.length) {
    const createdSession = await createSession(db, project.id, DEFAULT_SESSION_TITLE)
    sessions = [createdSession]
  }

  const activeSession = sessions[0]
  const [messages, worldbuildingEntries, outlineNodes] = await Promise.all([
    listMessages(db, activeSession.id),
    listWorldbuildingEntries(db, project.id),
    listOutlineNodes(db, project.id),
  ])

  return {
    settings,
    project,
    sessions,
    activeSession,
    messages,
    worldbuildingEntries,
    outlineNodes,
  }
}
