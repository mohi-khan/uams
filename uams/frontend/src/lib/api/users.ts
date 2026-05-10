import { apiClient } from './client'

export type UserStatus = 'active' | 'inactive' | 'suspended'
export type UserRole   = 'admin' | 'dean' | 'academic_coordinator' | 'teacher' | 'student'

export interface UserRow {
  id:           string
  firstName:    string
  lastName:     string
  email:        string
  role:         UserRole
  status:       UserStatus
  authProvider: 'email' | 'google'
  createdAt:    string
}

export interface ListUsersResponse {
  data:  UserRow[]
  total: number
  page:  number
  limit: number
}

export interface CreateUserPayload {
  firstName:    string
  lastName:     string
  email:        string
  role:         UserRole
  authProvider: 'email' | 'google'
  password?:    string
}

export async function listUsersApi(page = 1, search?: string): Promise<ListUsersResponse> {
  const { data } = await apiClient.get('/api/users', { params: { page, limit: 20, search } })
  return data
}

export async function createUserApi(payload: CreateUserPayload): Promise<UserRow> {
  const { data } = await apiClient.post('/api/users', payload)
  return data
}

export async function updateUserStatusApi(userId: string, status: UserStatus): Promise<void> {
  await apiClient.patch(`/api/users/${userId}/status`, { status })
}

export async function resetUserPasswordApi(userId: string, newPassword: string): Promise<void> {
  await apiClient.patch(`/api/users/${userId}/password`, { newPassword })
}
