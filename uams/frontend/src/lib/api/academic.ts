import { apiClient } from './client'

export interface FacultyRow {
  id:          string
  name:        string
  code:        string
  description: string | null
  isActive:    boolean
  createdAt:   string
  updatedAt:   string
}

export interface DepartmentRow {
  id:          string
  facultyId:   string
  facultyName: string | null
  name:        string
  code:        string
  description: string | null
  isActive:    boolean
  createdAt:   string
  updatedAt:   string
}

export interface AuditLogEntry {
  id:              string
  action:          'CREATE' | 'UPDATE' | 'DELETE'
  performedByName: string
  snapshot:        unknown
  createdAt:       string
}

export interface PagedResult<T> {
  data:  T[]
  total: number
  page:  number
  limit: number
}

// ── Faculty ──────────────────────────────────────────────────────────────────

export async function listFacultiesApi(page = 1, search?: string, limit = 20): Promise<PagedResult<FacultyRow>> {
  const { data } = await apiClient.get('/api/faculties', { params: { page, limit, search } })
  return data
}

export async function createFacultyApi(payload: { name: string; code: string; description?: string }): Promise<FacultyRow> {
  const { data } = await apiClient.post('/api/faculties', payload)
  return data
}

export async function updateFacultyApi(
  id: string,
  payload: { name?: string; code?: string; description?: string | null; isActive?: boolean },
): Promise<FacultyRow> {
  const { data } = await apiClient.put(`/api/faculties/${id}`, payload)
  return data
}

export async function deleteFacultyApi(id: string): Promise<void> {
  await apiClient.delete(`/api/faculties/${id}`)
}

export async function getFacultyAuditLogsApi(id: string): Promise<{ data: AuditLogEntry[] }> {
  const { data } = await apiClient.get(`/api/faculties/${id}/audit`)
  return data
}

// ── Department ───────────────────────────────────────────────────────────────

export async function listDepartmentsApi(page = 1, facultyId?: string, search?: string, limit = 20): Promise<PagedResult<DepartmentRow>> {
  const { data } = await apiClient.get('/api/departments', { params: { page, limit, facultyId, search } })
  return data
}

export async function createDepartmentApi(payload: { facultyId: string; name: string; code: string; description?: string }): Promise<DepartmentRow> {
  const { data } = await apiClient.post('/api/departments', payload)
  return data
}

export async function updateDepartmentApi(
  id: string,
  payload: { name?: string; code?: string; description?: string | null; isActive?: boolean },
): Promise<DepartmentRow> {
  const { data } = await apiClient.put(`/api/departments/${id}`, payload)
  return data
}

export async function deleteDepartmentApi(id: string): Promise<void> {
  await apiClient.delete(`/api/departments/${id}`)
}

export async function getDepartmentAuditLogsApi(id: string): Promise<{ data: AuditLogEntry[] }> {
  const { data } = await apiClient.get(`/api/departments/${id}/audit`)
  return data
}

// ── Course ────────────────────────────────────────────────────────────────────

export type CourseType   = 'CORE' | 'ELECTIVE'
export type CourseStatus = 'active' | 'inactive' | 'archived'

export interface CourseRow {
  id:             string
  departmentId:   string
  departmentName: string | null
  facultyName:    string | null
  code:           string
  title:          string
  credits:        number
  type:           CourseType
  status:         CourseStatus
  originalFee:    number
  retakeFee:      number
  createdAt:      string
  updatedAt:      string
}

export interface CreateCoursePayload {
  departmentId: string
  code:         string
  title:        string
  credits:      number
  type:         CourseType
  status:       CourseStatus
  originalFee:  number
  retakeFee:    number
}

export async function listCoursesApi(page = 1, departmentId?: string, search?: string, limit = 20): Promise<PagedResult<CourseRow>> {
  const { data } = await apiClient.get('/api/courses', { params: { page, limit, departmentId, search } })
  return data
}

export async function getCourseByIdApi(id: string): Promise<CourseRow> {
  const { data } = await apiClient.get(`/api/courses/${id}`)
  return data
}

export async function createCourseApi(payload: CreateCoursePayload): Promise<CourseRow> {
  const { data } = await apiClient.post('/api/courses', payload)
  return data
}

export async function updateCourseApi(
  id: string,
  payload: Partial<CreateCoursePayload>,
): Promise<CourseRow> {
  const { data } = await apiClient.put(`/api/courses/${id}`, payload)
  return data
}

export async function deleteCourseApi(id: string): Promise<void> {
  await apiClient.delete(`/api/courses/${id}`)
}

export async function getCourseAuditLogsApi(id: string): Promise<{ data: AuditLogEntry[] }> {
  const { data } = await apiClient.get(`/api/courses/${id}/audit`)
  return data
}

// ── Course Prerequisites ───────────────────────────────────────────────────────

export interface CoursePrerequisiteRow {
  id:                      string
  courseId:                string
  prerequisiteCourseId:    string
  prerequisiteCourseCode:  string
  prerequisiteCourseTitle: string
  minGrade:                string | null
  isMandatory:             boolean
}

export async function listPrerequisitesApi(courseId: string): Promise<{ data: CoursePrerequisiteRow[] }> {
  const { data } = await apiClient.get(`/api/courses/${courseId}/prerequisites`)
  return data
}

export async function addPrerequisiteApi(
  courseId: string,
  payload: { prerequisiteCourseId: string; minGrade?: string | null; isMandatory: boolean },
): Promise<CoursePrerequisiteRow> {
  const { data } = await apiClient.post(`/api/courses/${courseId}/prerequisites`, payload)
  return data
}

export async function removePrerequisiteApi(courseId: string, prereqId: string): Promise<void> {
  await apiClient.delete(`/api/courses/${courseId}/prerequisites/${prereqId}`)
}

// ── Program ───────────────────────────────────────────────────────────────────

export type DegreeLevel = 'bachelor' | 'master' | 'phd' | 'diploma' | 'certificate'

export interface ProgramRow {
  id:                string
  departmentId:      string
  departmentName:    string | null
  facultyName:       string | null
  name:              string
  code:              string
  degreeLevel:       DegreeLevel
  totalCredits:      number
  durationSemesters: number
  status:            CourseStatus
  createdAt:         string
  updatedAt:         string
}

export interface CreateProgramPayload {
  departmentId:      string
  name:              string
  code:              string
  degreeLevel:       DegreeLevel
  totalCredits:      number
  durationSemesters: number
  status:            CourseStatus
}

export interface ProgramCourseRow {
  id:          string
  programId:   string
  courseId:    string
  courseCode:  string
  courseTitle: string
  credits:     number
  courseType:  CourseType
  semesterNo:  number
  isMandatory: boolean
}

export async function listProgramsApi(page = 1, departmentId?: string, search?: string, limit = 20): Promise<PagedResult<ProgramRow>> {
  const { data } = await apiClient.get('/api/programs', { params: { page, limit, departmentId, search } })
  return data
}

export async function createProgramApi(payload: CreateProgramPayload): Promise<ProgramRow> {
  const { data } = await apiClient.post('/api/programs', payload)
  return data
}

export async function updateProgramApi(
  id: string,
  payload: Partial<CreateProgramPayload>,
): Promise<ProgramRow> {
  const { data } = await apiClient.put(`/api/programs/${id}`, payload)
  return data
}

export async function deleteProgramApi(id: string): Promise<void> {
  await apiClient.delete(`/api/programs/${id}`)
}

export async function getProgramAuditLogsApi(id: string): Promise<{ data: AuditLogEntry[] }> {
  const { data } = await apiClient.get(`/api/programs/${id}/audit`)
  return data
}

export async function listProgramCoursesApi(programId: string): Promise<{ data: ProgramCourseRow[] }> {
  const { data } = await apiClient.get(`/api/programs/${programId}/courses`)
  return data
}

export async function addProgramCourseApi(
  programId: string,
  payload: { courseId: string; semesterNo: number; isMandatory: boolean },
): Promise<ProgramCourseRow> {
  const { data } = await apiClient.post(`/api/programs/${programId}/courses`, payload)
  return data
}

export async function updateProgramCourseApi(
  programId: string,
  mappingId: string,
  payload: { semesterNo?: number; isMandatory?: boolean },
): Promise<ProgramCourseRow> {
  const { data } = await apiClient.put(`/api/programs/${programId}/courses/${mappingId}`, payload)
  return data
}

export async function removeProgramCourseApi(programId: string, mappingId: string): Promise<void> {
  await apiClient.delete(`/api/programs/${programId}/courses/${mappingId}`)
}
