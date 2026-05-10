import { apiClient } from './client'
import type { AuditLogEntry, PagedResult } from './academic'

export type SemesterOfferingStatus = 'planned' | 'active' | 'completed'

export interface SemesterOfferingRow {
  id:           string
  programId:    string
  programName:  string
  programCode:  string
  sessionId:    string
  sessionName:  string
  semesterNo:   number
  status:       SemesterOfferingStatus
  startDate:    string | null
  endDate:      string | null
  courseCount:  number
  createdAt:    string
  updatedAt:    string
}

export interface SemesterOfferingDetail extends SemesterOfferingRow {
  durationSemesters: number
}

export interface CourseOfferingRow {
  id:                 string
  semesterOfferingId: string
  courseId:           string
  courseCode:         string
  courseTitle:        string
  credits:            number
  courseType:         'CORE' | 'ELECTIVE'
  batchId:            string | null
  batchName:          string | null
  batchCode:          string | null
  capacity:           number | null
  teacherId:          string | null
  teacherName:        string | null
  scheduleInfo:       Record<string, unknown> | null
  createdAt:          string
  updatedAt:          string
}

export interface AvailableCourseRow {
  programCourseId: string
  courseId:        string
  courseCode:      string
  courseTitle:     string
  credits:         number
  courseType:      'CORE' | 'ELECTIVE'
  semesterNo:      number
  isMandatory:     boolean
}

export interface BulkSaveCourseOfferingsPayload {
  semesterOfferingId: string
  courses: {
    courseId:      string
    batchId?:      string | null
    capacity?:     number | null
    teacherId?:    string | null
    scheduleInfo?: Record<string, unknown> | null
  }[]
}

// ── Semester Offerings ────────────────────────────────────────────────────────

export async function listSemesterOfferingsApi(
  opts: { programId?: string; sessionId?: string; semesterNo?: number; status?: string; page?: number; limit?: number } = {},
): Promise<PagedResult<SemesterOfferingRow>> {
  const { data } = await apiClient.get('/api/semester-offerings', { params: opts })
  return data
}

export async function getSemesterOfferingApi(id: string): Promise<SemesterOfferingDetail> {
  const { data } = await apiClient.get(`/api/semester-offerings/${id}`)
  return data
}

export async function createSemesterOfferingApi(payload: {
  programId: string; sessionId: string; semesterNo: number
  status?: SemesterOfferingStatus; startDate?: string | null; endDate?: string | null
}): Promise<SemesterOfferingDetail> {
  const { data } = await apiClient.post('/api/semester-offerings', payload)
  return data
}

export async function updateSemesterOfferingApi(id: string, payload: {
  status?: SemesterOfferingStatus; startDate?: string | null; endDate?: string | null
}): Promise<SemesterOfferingDetail> {
  const { data } = await apiClient.put(`/api/semester-offerings/${id}`, payload)
  return data
}

export async function deleteSemesterOfferingApi(id: string): Promise<void> {
  await apiClient.delete(`/api/semester-offerings/${id}`)
}

export async function getSemesterOfferingAuditLogsApi(id: string): Promise<{ data: AuditLogEntry[] }> {
  const { data } = await apiClient.get(`/api/semester-offerings/${id}/audit`)
  return data
}

// ── Course Offerings ──────────────────────────────────────────────────────────

export async function listCourseOfferingsApi(semesterOfferingId: string): Promise<{ data: CourseOfferingRow[] }> {
  const { data } = await apiClient.get(`/api/semester-offerings/${semesterOfferingId}/courses`)
  return data
}

export async function getAvailableCoursesApi(semesterOfferingId: string): Promise<{ data: AvailableCourseRow[] }> {
  const { data } = await apiClient.get(`/api/semester-offerings/${semesterOfferingId}/courses/available`)
  return data
}

export async function bulkSaveCourseOfferingsApi(
  semesterOfferingId: string,
  payload: BulkSaveCourseOfferingsPayload,
): Promise<{ data: CourseOfferingRow[] }> {
  const { data } = await apiClient.post(`/api/semester-offerings/${semesterOfferingId}/courses/bulk`, payload)
  return data
}

export async function updateCourseOfferingApi(
  semesterOfferingId: string,
  courseOffId: string,
  payload: { section?: string; capacity?: number | null; teacherId?: string | null; scheduleInfo?: Record<string, unknown> | null },
): Promise<CourseOfferingRow> {
  const { data } = await apiClient.put(`/api/semester-offerings/${semesterOfferingId}/courses/${courseOffId}`, payload)
  return data
}

export async function deleteCourseOfferingApi(semesterOfferingId: string, courseOffId: string): Promise<void> {
  await apiClient.delete(`/api/semester-offerings/${semesterOfferingId}/courses/${courseOffId}`)
}

export async function getCourseOfferingAuditLogsApi(
  semesterOfferingId: string,
  courseOffId: string,
): Promise<{ data: AuditLogEntry[] }> {
  const { data } = await apiClient.get(`/api/semester-offerings/${semesterOfferingId}/courses/${courseOffId}/audit`)
  return data
}
