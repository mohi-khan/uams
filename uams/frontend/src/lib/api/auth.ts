import { apiClient } from './client'
import type { AuthTokens, User } from '@/types'

export interface LoginPayload {
  email: string
  password: string
}

export interface LoginResponse extends AuthTokens {
  user: User
}

export async function loginApi(payload: LoginPayload): Promise<LoginResponse> {
  const { data } = await apiClient.post<LoginResponse>('/api/auth/login', payload)
  return data
}

export async function logoutApi(): Promise<void> {
  await apiClient.post('/api/auth/logout')
}

export async function activateInvitationApi(payload: { token: string; password: string }): Promise<{ message: string }> {
  const { data } = await apiClient.post('/api/auth/activate-invitation', payload)
  return data
}

export async function googleLoginApi(idToken: string): Promise<LoginResponse> {
  const { data } = await apiClient.post<LoginResponse>('/api/auth/google', { idToken })
  return data
}

export async function devLoginApi(studentId: string): Promise<LoginResponse> {
  const { data } = await apiClient.post<LoginResponse>('/api/auth/dev-login', { studentId })
  return data
}
