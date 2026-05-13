export const worldbuildingCategories = [
  '世界背景',
  '历史沿革',
  '地域势力',
  '角色阵营',
  '科技体系',
  '魔法体系',
  '核心冲突',
  '剧情大纲',
] as const

export const outlineKinds = [
  'premise',
  'act',
  'chapter',
  'beat',
  'conflict',
  'arc',
] as const

export type WorldbuildingCategory = (typeof worldbuildingCategories)[number]
export type OutlineKind = (typeof outlineKinds)[number]
export type MessageRole = 'user' | 'assistant'

export interface AppSettings {
  baseUrl: string
  apiKey: string
  model: string
  updatedAt: string
}

export interface Project {
  id: string
  name: string
  description: string
  createdAt: string
  updatedAt: string
}

export interface Session {
  id: string
  projectId: string
  title: string
  createdAt: string
  updatedAt: string
}

export interface Message {
  id: string
  sessionId: string
  role: MessageRole
  content: string
  createdAt: string
}

export interface WorldbuildingEntry {
  id: string
  projectId: string
  sessionId: string | null
  category: WorldbuildingCategory
  title: string
  summary: string
  details: string
  createdAt: string
  updatedAt: string
}

export interface OutlineNode {
  id: string
  projectId: string
  sessionId: string | null
  kind: OutlineKind
  title: string
  summary: string
  position: number
  createdAt: string
  updatedAt: string
}

export interface BootstrapResponse {
  settings: AppSettings
  project: Project
  sessions: Session[]
  activeSession: Session
  messages: Message[]
  worldbuildingEntries: WorldbuildingEntry[]
  outlineNodes: OutlineNode[]
}

export interface SettingsInput {
  baseUrl: string
  apiKey: string
  model: string
}

export interface ChatRequest {
  projectId: string
  sessionId: string
  message: string
}

export interface ChatResponse {
  session: Session
  userMessage: Message
  assistantMessage: Message
  worldbuildingEntries: WorldbuildingEntry[]
  outlineNodes: OutlineNode[]
}
