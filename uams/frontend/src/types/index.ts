export type Role = 'super_admin' | 'admin' | 'dean' | 'academic_coordinator' | 'teacher' | 'student'

export type AuthProvider = 'email' | 'google'

export interface User {
  id: string
  tenantId: string | null
  email: string
  firstName: string
  lastName: string
  role: Role
  authProvider: AuthProvider
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
}
