import { apiClient } from './client'
import type { AuditLogEntry, PagedResult } from './academic'

export type Designation = 'Professor' | 'Lecturer'

export interface TeacherRow {
  id:             string
  departmentId:   string
  departmentName: string | null
  facultyId:      string
  facultyName:    string | null
  name:           string
  email:          string
  phone:          string | null
  designation:    Designation
  joiningDate:    string
  isActive:       boolean
  createdAt:      string
  updatedAt:      string
}

export interface CreateTeacherPayload {
  departmentId: string
  facultyId:    string
  name:         string
  email:        string
  phone?:       string
  designation:  Designation
  joiningDate:  string
}

export interface UpdateTeacherPayload {
  departmentId?: string
  facultyId?:    string
  name?:         string
  phone?:        string | null
  designation?:  Designation
  joiningDate?:  string
  isActive?:     boolean
}

export async function listTeachersApi(
  page = 1,
  departmentId?: string,
  facultyId?: string,
  search?: string,
  limit = 20,
): Promise<PagedResult<TeacherRow>> {
  const { data } = await apiClient.get('/api/teachers', {
    params: { page, limit, departmentId, facultyId, search },
  })
  return data
}

export async function createTeacherApi(payload: CreateTeacherPayload): Promise<TeacherRow> {
  const { data } = await apiClient.post('/api/teachers', payload)
  return data
}

export async function updateTeacherApi(id: string, payload: UpdateTeacherPayload): Promise<TeacherRow> {
  const { data } = await apiClient.put(`/api/teachers/${id}`, payload)
  return data
}

export async function toggleTeacherStatusApi(id: string): Promise<TeacherRow> {
  const { data } = await apiClient.patch(`/api/teachers/${id}/toggle-status`)
  return data
}

export async function resendTeacherInvitationApi(id: string): Promise<{ message: string }> {
  const { data } = await apiClient.post(`/api/teachers/${id}/resend-invitation`)
  return data
}

export async function getTeacherAuditLogsApi(id: string): Promise<{ data: AuditLogEntry[] }> {
  const { data } = await apiClient.get(`/api/teachers/${id}/audit`)
  return data
}

// ── Teacher self-service ──────────────────────────────────────────────────────

export type SemesterOfferingStatus = 'planned' | 'active' | 'completed'
export type CourseType = 'CORE' | 'ELECTIVE'

export interface AssignedCourseRow {
  courseOfferingId:   string
  courseId:           string
  courseCode:         string
  courseTitle:        string
  credits:            number
  courseType:         CourseType
  batchId:            string | null
  batchName:          string | null
  batchCode:          string | null
  capacity:           number | null
  scheduleInfo:       Record<string, unknown> | null
  semesterOfferingId: string
  semesterNo:         number
  semesterStatus:     SemesterOfferingStatus
  semesterStartDate:  string | null
  semesterEndDate:    string | null
  programId:          string
  programName:        string
  programCode:        string
  sessionId:          string
  sessionName:        string
}

export interface MyCoursesResult {
  teacher: { id: string; name: string; designation: string }
  data:    AssignedCourseRow[]
}

export async function getMyAssignedCoursesApi(): Promise<MyCoursesResult> {
  const { data } = await apiClient.get('/api/teachers/me/courses')
  return data
}
