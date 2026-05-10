export type Role = 'super_admin' | 'admin' | 'dean' | 'academic_coordinator' | 'teacher' | 'student'

export interface JwtPayload {
  sub: string        // user id
  tenantId: string
  role: Role
  iat?: number
  exp?: number
}

export interface TenantContext {
  tenantId: string
}
