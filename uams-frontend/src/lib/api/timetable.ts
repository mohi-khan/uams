import { apiClient } from './client'

export type RoomType = 'THEORY' | 'LAB'

export interface TimeSlotRow {
  id:              string
  tenantId:        string
  name:            string
  startTime:       string
  endTime:         string
  durationMinutes: number
  isActive:        boolean
  createdAt:       string
  updatedAt:       string
}

export interface RoomRow {
  id:        string
  tenantId:  string
  name:      string
  capacity:  number
  type:      RoomType
  isActive:  boolean
  createdAt: string
  updatedAt: string
}

export interface CreateSlotPayload {
  name:            string
  startTime:       string
  endTime:         string
  durationMinutes: number
  isActive:        boolean
}

export interface CreateRoomPayload {
  name:     string
  capacity: number
  type:     RoomType
  isActive: boolean
}

// ── Slots ─────────────────────────────────────────────────────────────────────

export async function listSlotsApi(activeOnly?: boolean): Promise<{ data: TimeSlotRow[] }> {
  const params: Record<string, string> = {}
  if (activeOnly) params.active = 'true'
  const { data } = await apiClient.get('/api/slots', { params })
  return data
}

export async function createSlotApi(payload: CreateSlotPayload): Promise<TimeSlotRow> {
  const { data } = await apiClient.post('/api/slots', payload)
  return data
}

export async function updateSlotApi(id: string, payload: Partial<CreateSlotPayload>): Promise<TimeSlotRow> {
  const { data } = await apiClient.put(`/api/slots/${id}`, payload)
  return data
}

export async function deleteSlotApi(id: string): Promise<{ success: boolean }> {
  const { data } = await apiClient.delete(`/api/slots/${id}`)
  return data
}

export async function bulkCreateSlotsApi(rows: CreateSlotPayload[]): Promise<{ inserted: number; data: TimeSlotRow[] }> {
  const { data } = await apiClient.post('/api/slots/bulk', { rows })
  return data
}

// ── Rooms ─────────────────────────────────────────────────────────────────────

export async function listRoomsApi(activeOnly?: boolean, type?: RoomType): Promise<{ data: RoomRow[] }> {
  const params: Record<string, string> = {}
  if (activeOnly) params.active = 'true'
  if (type)       params.type   = type
  const { data } = await apiClient.get('/api/rooms', { params })
  return data
}

export async function createRoomApi(payload: CreateRoomPayload): Promise<RoomRow> {
  const { data } = await apiClient.post('/api/rooms', payload)
  return data
}

export async function updateRoomApi(id: string, payload: Partial<CreateRoomPayload>): Promise<RoomRow> {
  const { data } = await apiClient.put(`/api/rooms/${id}`, payload)
  return data
}

export async function deleteRoomApi(id: string): Promise<{ success: boolean }> {
  const { data } = await apiClient.delete(`/api/rooms/${id}`)
  return data
}

export async function bulkCreateRoomsApi(rows: CreateRoomPayload[]): Promise<{ inserted: number; data: RoomRow[] }> {
  const { data } = await apiClient.post('/api/rooms/bulk', { rows })
  return data
}
