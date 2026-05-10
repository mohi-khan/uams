import { apiClient } from './client'

export type Tier = '0-50' | '51-100' | '101-500' | '501-1000' | '1001+'

export interface RegisterTenantPayload {
  universityName: string
  universityEmail: string
  phone?: string
  address?: string
  city?: string
  country: string
  tier: Tier
  firstName: string
  lastName: string
  adminEmail: string
  password: string
}

export async function registerTenant(payload: RegisterTenantPayload) {
  const { data } = await apiClient.post('/api/tenants/register', payload)
  return data as { message: string }
}

export async function verifyTenant(token: string) {
  const { data } = await apiClient.get(`/api/tenants/verify?token=${token}`)
  return data as { message: string }
}
