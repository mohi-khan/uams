import { apiClient } from './client'
import type { AuditLogEntry, PagedResult } from './academic'

export interface BatchRow {
  id:          string
  tenantId:    string
  programId:   string
  programName: string | null
  sessionId:   string | null
  sessionName: string | null
  code:        string
  name:        string
  capacity:    number | null
  isActive:    boolean
  createdAt:   string
  updatedAt:   string
}

export interface CreateBatchPayload {
  programId:  string
  sessionId?: string
  code:       string
  name:       string
  capacity?:  number
}

export interface UpdateBatchPayload {
  programId?: string
  sessionId?: string | null
  code?:      string
  name?:      string
  capacity?:  number | null
  isActive?:  boolean
}

export async function listBatchesApi(
  page = 1,
  programId?: string,
  search?: string,
  limit = 20,
): Promise<PagedResult<BatchRow>> {
  const { data } = await apiClient.get('/api/batches', { params: { page, limit, programId, search } })
  return data
}

export async function createBatchApi(payload: CreateBatchPayload): Promise<BatchRow> {
  const { data } = await apiClient.post('/api/batches', payload)
  return data
}

export async function updateBatchApi(id: string, payload: UpdateBatchPayload): Promise<BatchRow> {
  const { data } = await apiClient.put(`/api/batches/${id}`, payload)
  return data
}

export async function deleteBatchApi(id: string): Promise<void> {
  await apiClient.delete(`/api/batches/${id}`)
}

export async function getBatchAuditLogsApi(id: string): Promise<{ data: AuditLogEntry[] }> {
  const { data } = await apiClient.get(`/api/batches/${id}/audit`)
  return data
}
