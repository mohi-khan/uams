import { apiClient } from './client'
import type { AuditLogEntry, PagedResult } from './academic'

export interface StudentRow {
  id:             string
  tenantId:       string
  studentCode:    string
  name:           string
  email:          string
  gmailAccount:   string | null
  phone:          string | null
  address:        string | null
  emergencyPhone: string | null
  nidBirthReg:    string | null
  photoUrl:       string | null
  isActive:       boolean
  createdAt:      string
  updatedAt:      string
}

export interface CreateStudentPayload {
  studentCode:     string
  name:            string
  email:           string
  gmailAccount:    string
  phone?:          string
  address?:        string
  emergencyPhone?: string
  nidBirthReg?:    string
  photoUrl?:       string
}

export interface UpdateStudentPayload {
  studentCode?:    string
  name?:           string
  gmailAccount?:   string
  phone?:          string | null
  address?:        string | null
  emergencyPhone?: string | null
  nidBirthReg?:    string | null
  photoUrl?:       string | null
  isActive?:       boolean
}

export async function getStudentMeApi(): Promise<StudentRow> {
  const { data } = await apiClient.get('/api/students/me')
  return data
}

export async function listStudentsApi(page = 1, search?: string, limit = 20): Promise<PagedResult<StudentRow>> {
  const { data } = await apiClient.get('/api/students', { params: { page, limit, search } })
  return data
}

export async function createStudentApi(payload: CreateStudentPayload): Promise<StudentRow> {
  const { data } = await apiClient.post('/api/students', payload)
  return data
}

export async function updateStudentApi(id: string, payload: UpdateStudentPayload): Promise<StudentRow> {
  const { data } = await apiClient.put(`/api/students/${id}`, payload)
  return data
}

export async function deleteStudentApi(id: string): Promise<void> {
  await apiClient.delete(`/api/students/${id}`)
}

export async function getStudentAuditLogsApi(id: string): Promise<{ data: AuditLogEntry[] }> {
  const { data } = await apiClient.get(`/api/students/${id}/audit`)
  return data
}

export async function revealStudentNidApi(id: string, password: string): Promise<{ nid: string }> {
  const { data } = await apiClient.post(`/api/students/${id}/reveal-nid`, { password })
  return data
}

export async function getPhotoUploadUrlApi(
  filename: string,
  contentType: 'image/jpeg' | 'image/png' | 'image/webp',
): Promise<{ uploadUrl: string; publicUrl: string }> {
  const { data } = await apiClient.get('/api/students/photo-upload-url', {
    params: { filename, contentType },
  })
  return data
}

export interface StudentCourseRow {
  offering_id:         string
  course_id:           string
  course_code:         string
  course_title:        string
  credits:             number
  course_type:         string
  semester_no:         number
  semester_status:     string
  semester_start_date: string | null
  semester_end_date:   string | null
  program_name:        string
  program_code:        string
  session_name:        string
  batch_id:            string | null
  batch_name:          string | null
  batch_code:          string | null
  teacher_name:        string | null
  has_schedule:        boolean
}

export async function getStudentCoursesApi(): Promise<StudentCourseRow[]> {
  const { data } = await apiClient.get('/api/students/me/courses')
  return data.data
}

// Uploads file directly to S3 via pre-signed URL, returns the public URL
export async function uploadStudentPhoto(file: File): Promise<string> {
  const contentType = file.type as 'image/jpeg' | 'image/png' | 'image/webp'
  const { uploadUrl, publicUrl } = await getPhotoUploadUrlApi(file.name, contentType)
  await fetch(uploadUrl, {
    method:  'PUT',
    body:    file,
    headers: { 'Content-Type': contentType },
  })
  return publicUrl
}
