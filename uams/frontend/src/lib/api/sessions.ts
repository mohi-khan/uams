import { apiClient } from './client'
import type { AuditLogEntry, PagedResult } from './academic'

export type Term          = 'SPRING' | 'SUMMER' | 'FALL'
export type SessionStatus = 'draft' | 'active' | 'completed' | 'archived'

export interface SessionRow {
  id:        string
  tenantId:  string
  name:      string
  year:      number
  term:      Term
  startDate: string
  endDate:   string
  status:    SessionStatus
  createdAt: string
  updatedAt: string
}

export interface CreateSessionPayload {
  name:      string
  year:      number
  term:      Term
  startDate: string
  endDate:   string
  status:    SessionStatus
}

export interface UpdateSessionPayload {
  name?:      string
  year?:      number
  term?:      Term
  startDate?: string
  endDate?:   string
  status?:    SessionStatus
}

export async function listSessionsApi(page = 1, search?: string, limit = 20): Promise<PagedResult<SessionRow>> {
  const { data } = await apiClient.get('/api/sessions', { params: { page, limit, search } })
  return data
}

export async function createSessionApi(payload: CreateSessionPayload): Promise<SessionRow> {
  const { data } = await apiClient.post('/api/sessions', payload)
  return data
}

export async function updateSessionApi(id: string, payload: UpdateSessionPayload): Promise<SessionRow> {
  const { data } = await apiClient.put(`/api/sessions/${id}`, payload)
  return data
}

export async function deleteSessionApi(id: string): Promise<void> {
  await apiClient.delete(`/api/sessions/${id}`)
}

export async function getSessionAuditLogsApi(id: string): Promise<{ data: AuditLogEntry[] }> {
  const { data } = await apiClient.get(`/api/sessions/${id}/audit`)
  return data
}
