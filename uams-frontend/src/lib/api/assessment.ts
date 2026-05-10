import { apiClient } from './client'

export type AssessmentPlanStatus   = 'draft' | 'final'
export type AssessmentComponentType = 'quiz' | 'assignment' | 'midterm' | 'final' | 'lab' | 'project' | 'presentation' | 'other'

export const COMPONENT_TYPE_LABELS: Record<AssessmentComponentType, string> = {
  quiz:         'Quiz',
  assignment:   'Assignment',
  midterm:      'Midterm',
  final:        'Final Exam',
  lab:          'Lab',
  project:      'Project',
  presentation: 'Presentation',
  other:        'Other',
}

export const COMPONENT_TYPE_COLORS: Record<AssessmentComponentType, string> = {
  quiz:         'bg-blue-100 text-blue-700',
  assignment:   'bg-teal-100 text-teal-700',
  midterm:      'bg-amber-100 text-amber-700',
  final:        'bg-red-100 text-red-700',
  lab:          'bg-green-100 text-green-700',
  project:      'bg-purple-100 text-purple-700',
  presentation: 'bg-pink-100 text-pink-700',
  other:        'bg-gray-100 text-gray-600',
}

export interface CloLinkRow {
  id:          string
  componentId: string
  cloId:       string
  cloCode:     string
  cloDesc:     string
  weight:      string
}

export interface AssessmentComponentRow {
  id:               string
  planId:           string
  name:             string
  componentType:    AssessmentComponentType
  weightPercentage: string
  totalMarks:       number
  assessmentCount:  number
  cloMapped:        boolean
  orderNo:          number
  createdAt:        string
  updatedAt:        string
  cloLinks:         CloLinkRow[]
}

export interface AssessmentPlanRow {
  id:                string
  courseId:          string
  academicSessionId: string
  version:           string
  status:            AssessmentPlanStatus
  isDefault:         boolean
  createdAt:         string
  updatedAt:         string
}

export interface AssessmentPlanDetail extends AssessmentPlanRow {
  components: AssessmentComponentRow[]
}

export interface CreatePlanPayload {
  courseId:          string
  academicSessionId: string
}

export interface CopyPlanPayload {
  courseId:        string
  sourceSessionId: string
  targetSessionId: string
}

export interface CreateComponentPayload {
  name:             string
  componentType:    AssessmentComponentType
  weightPercentage: number
  totalMarks:       number
  assessmentCount:  number
  cloMapped:        boolean
}

export interface UpdateComponentPayload {
  name?:             string
  componentType?:    AssessmentComponentType
  weightPercentage?: number
  totalMarks?:       number
  assessmentCount?:  number
  cloMapped?:        boolean
}

export interface AddCloLinkPayload {
  cloId:  string
  weight: number
}

// ── Plans ─────────────────────────────────────────────────────────────────────

export async function listPlansApi(courseId: string, sessionId?: string): Promise<{ data: AssessmentPlanRow[] }> {
  const params: Record<string, string> = { courseId }
  if (sessionId) params.sessionId = sessionId
  const { data } = await apiClient.get('/api/assessment-plans', { params })
  return data
}

export async function createPlanApi(payload: CreatePlanPayload): Promise<AssessmentPlanRow> {
  const { data } = await apiClient.post('/api/assessment-plans', payload)
  return data
}

export async function copyPlanApi(payload: CopyPlanPayload): Promise<AssessmentPlanRow> {
  const { data } = await apiClient.post('/api/assessment-plans/copy', payload)
  return data
}

export async function getPlanApi(id: string): Promise<AssessmentPlanDetail> {
  const { data } = await apiClient.get(`/api/assessment-plans/${id}`)
  return data
}

export async function finalizePlanApi(id: string): Promise<AssessmentPlanRow> {
  const { data } = await apiClient.put(`/api/assessment-plans/${id}/finalize`)
  return data
}

export async function setDefaultPlanApi(id: string): Promise<AssessmentPlanRow> {
  const { data } = await apiClient.put(`/api/assessment-plans/${id}/set-default`)
  return data
}

export async function deletePlanApi(id: string): Promise<{ success: boolean }> {
  const { data } = await apiClient.delete(`/api/assessment-plans/${id}`)
  return data
}

// ── Components ────────────────────────────────────────────────────────────────

export async function createComponentApi(planId: string, payload: CreateComponentPayload): Promise<AssessmentComponentRow> {
  const { data } = await apiClient.post(`/api/assessment-plans/${planId}/components`, payload)
  return data
}

export async function updateComponentApi(planId: string, componentId: string, payload: UpdateComponentPayload): Promise<AssessmentComponentRow> {
  const { data } = await apiClient.put(`/api/assessment-plans/${planId}/components/${componentId}`, payload)
  return data
}

export async function deleteComponentApi(planId: string, componentId: string): Promise<{ success: boolean }> {
  const { data } = await apiClient.delete(`/api/assessment-plans/${planId}/components/${componentId}`)
  return data
}

// ── CLO Links ─────────────────────────────────────────────────────────────────

export async function addCloLinkApi(planId: string, componentId: string, payload: AddCloLinkPayload): Promise<CloLinkRow> {
  const { data } = await apiClient.post(`/api/assessment-plans/${planId}/components/${componentId}/clos`, payload)
  return data
}

export async function removeCloLinkApi(planId: string, componentId: string, linkId: string): Promise<{ success: boolean }> {
  const { data } = await apiClient.delete(`/api/assessment-plans/${planId}/components/${componentId}/clos/${linkId}`)
  return data
}
