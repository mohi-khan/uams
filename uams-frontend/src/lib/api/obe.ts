import { apiClient } from './client'

export type BloomsLevel = 'remember' | 'understand' | 'apply' | 'analyze' | 'evaluate' | 'create'

export const BLOOMS_LABELS: Record<BloomsLevel, string> = {
  remember:   'Remember',
  understand: 'Understand',
  apply:      'Apply',
  analyze:    'Analyze',
  evaluate:   'Evaluate',
  create:     'Create',
}

export const BLOOMS_COLORS: Record<BloomsLevel, string> = {
  remember:   'bg-gray-100 text-gray-600',
  understand: 'bg-blue-100 text-blue-700',
  apply:      'bg-teal-100 text-teal-700',
  analyze:    'bg-purple-100 text-purple-700',
  evaluate:   'bg-amber-100 text-amber-700',
  create:     'bg-rose-100 text-rose-700',
}

// ── CLO types ─────────────────────────────────────────────────────────────────

export interface CloRow {
  id:          string
  courseId:    string
  code:        string
  description: string
  bloomsLevel: BloomsLevel | null
  createdAt:   string
  updatedAt:   string
}

export interface CreateCloPayload {
  courseId:    string
  description: string
  bloomsLevel?: BloomsLevel
}

export interface UpdateCloPayload {
  description?: string
  bloomsLevel?: BloomsLevel | null
}

// ── PLO types ─────────────────────────────────────────────────────────────────

export interface PloRow {
  id:          string
  programId:   string
  code:        string
  description: string
  createdAt:   string
  updatedAt:   string
}

export interface CreatePloPayload {
  programId:   string
  description: string
}

export interface UpdatePloPayload {
  description?: string
}

// ── Mapping types ─────────────────────────────────────────────────────────────

export interface MappingRow {
  id:             string
  cloId:          string
  cloCode:        string
  cloDescription: string
  ploId:          string
  ploCode:        string
  ploDescription: string
  weight:         string
  createdAt:      string
  updatedAt:      string
}

export interface CreateMappingPayload {
  cloId:  string
  ploId:  string
  weight: number
}

export interface UpdateMappingPayload {
  weight: number
}

// ── CLO API ───────────────────────────────────────────────────────────────────

export async function listClosApi(courseId: string): Promise<{ data: CloRow[] }> {
  const { data } = await apiClient.get('/api/obe/clos', { params: { courseId } })
  return data
}

export async function createCloApi(payload: CreateCloPayload): Promise<CloRow> {
  const { data } = await apiClient.post('/api/obe/clos', payload)
  return data
}

export async function updateCloApi(id: string, payload: UpdateCloPayload): Promise<CloRow> {
  const { data } = await apiClient.put(`/api/obe/clos/${id}`, payload)
  return data
}

export async function deleteCloApi(id: string): Promise<{ success: boolean }> {
  const { data } = await apiClient.delete(`/api/obe/clos/${id}`)
  return data
}

// ── PLO API ───────────────────────────────────────────────────────────────────

export async function listPlosApi(programId: string): Promise<{ data: PloRow[] }> {
  const { data } = await apiClient.get('/api/obe/plos', { params: { programId } })
  return data
}

export async function createPloApi(payload: CreatePloPayload): Promise<PloRow> {
  const { data } = await apiClient.post('/api/obe/plos', payload)
  return data
}

export async function updatePloApi(id: string, payload: UpdatePloPayload): Promise<PloRow> {
  const { data } = await apiClient.put(`/api/obe/plos/${id}`, payload)
  return data
}

export async function deletePloApi(id: string): Promise<{ success: boolean }> {
  const { data } = await apiClient.delete(`/api/obe/plos/${id}`)
  return data
}

// ── Mapping API ───────────────────────────────────────────────────────────────

export async function listMappingsApi(params: { cloId?: string; ploId?: string; courseId?: string }): Promise<{ data: MappingRow[] }> {
  const { data } = await apiClient.get('/api/obe/mappings', { params })
  return data
}

export async function createMappingApi(payload: CreateMappingPayload): Promise<MappingRow> {
  const { data } = await apiClient.post('/api/obe/mappings', payload)
  return data
}

export async function updateMappingApi(id: string, payload: UpdateMappingPayload): Promise<MappingRow> {
  const { data } = await apiClient.put(`/api/obe/mappings/${id}`, payload)
  return data
}

export async function deleteMappingApi(id: string): Promise<{ success: boolean }> {
  const { data } = await apiClient.delete(`/api/obe/mappings/${id}`)
  return data
}
