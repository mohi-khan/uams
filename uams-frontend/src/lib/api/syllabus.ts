import { apiClient } from './client'

export type SyllabusStatus = 'draft' | 'final'

export interface SyllabusRow {
  id:        string
  courseId:  string
  version:   string
  isDefault: boolean
  status:    SyllabusStatus
  createdAt: string
  updatedAt: string
}

export interface SyllabusTopic {
  id:             string
  tenantId:       string
  syllabusId:     string
  title:          string
  description:    string | null
  status:         SyllabusStatus
  orderNo:        number
  estimatedHours: string | null
  createdAt:      string
  updatedAt:      string
}

export interface SyllabusWithTopics extends SyllabusRow {
  topics: SyllabusTopic[]
}

export interface UpsertTopicPayload {
  title:          string
  description?:   string | null
  orderNo?:       number
  estimatedHours?: number | null
}

// ── API functions ─────────────────────────────────────────────────────────────

export async function listSyllabiApi(courseId: string): Promise<{ data: SyllabusRow[] }> {
  const { data } = await apiClient.get('/api/syllabi', { params: { courseId } })
  return data
}

export async function createSyllabusApi(courseId: string): Promise<SyllabusRow> {
  const { data } = await apiClient.post('/api/syllabi', { courseId })
  return data
}

export async function getSyllabusApi(syllabusId: string): Promise<SyllabusWithTopics> {
  const { data } = await apiClient.get(`/api/syllabi/${syllabusId}`)
  return data
}

export async function finalizeSyllabusApi(syllabusId: string): Promise<SyllabusRow> {
  const { data } = await apiClient.put(`/api/syllabi/${syllabusId}/finalize`)
  return data
}

export async function setDefaultSyllabusApi(syllabusId: string): Promise<SyllabusRow> {
  const { data } = await apiClient.put(`/api/syllabi/${syllabusId}/set-default`)
  return data
}

export async function deleteSyllabusApi(syllabusId: string): Promise<{ success: boolean }> {
  const { data } = await apiClient.delete(`/api/syllabi/${syllabusId}`)
  return data
}

export async function createTopicApi(
  syllabusId: string,
  payload: UpsertTopicPayload,
): Promise<SyllabusTopic> {
  const { data } = await apiClient.post(`/api/syllabi/${syllabusId}/topics`, payload)
  return data
}

export async function updateTopicApi(
  syllabusId: string,
  topicId: string,
  payload: UpsertTopicPayload,
): Promise<SyllabusTopic> {
  const { data } = await apiClient.put(`/api/syllabi/${syllabusId}/topics/${topicId}`, payload)
  return data
}

export async function deleteTopicApi(
  syllabusId: string,
  topicId: string,
): Promise<{ success: boolean }> {
  const { data } = await apiClient.delete(`/api/syllabi/${syllabusId}/topics/${topicId}`)
  return data
}

export async function reorderTopicsApi(
  syllabusId: string,
  orderedIds: string[],
): Promise<{ success: boolean }> {
  const { data } = await apiClient.put(`/api/syllabi/${syllabusId}/topics/reorder`, { orderedIds })
  return data
}
