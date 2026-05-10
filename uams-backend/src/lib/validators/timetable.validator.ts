import { z } from 'zod'

const timeRegex = /^\d{2}:\d{2}$/

// ── Slots ─────────────────────────────────────────────────────────────────────

export const createSlotSchema = z.object({
  name:            z.string().min(1).max(50),
  startTime:       z.string().regex(timeRegex, 'Format must be HH:MM'),
  endTime:         z.string().regex(timeRegex, 'Format must be HH:MM'),
  durationMinutes: z.number().int().min(1),
  isActive:        z.boolean().default(true),
})

export const updateSlotSchema = createSlotSchema.partial()

export const bulkCreateSlotsSchema = z.object({
  rows: z.array(createSlotSchema).min(1).max(200),
})

// ── Rooms ─────────────────────────────────────────────────────────────────────

export const createRoomSchema = z.object({
  name:     z.string().min(1).max(100),
  capacity: z.number().int().min(1),
  type:     z.enum(['THEORY', 'LAB']).default('THEORY'),
  isActive: z.boolean().default(true),
})

export const updateRoomSchema = createRoomSchema.partial()

export const bulkCreateRoomsSchema = z.object({
  rows: z.array(createRoomSchema).min(1).max(500),
})

// ── Types ─────────────────────────────────────────────────────────────────────

export type CreateSlotInput      = z.infer<typeof createSlotSchema>
export type UpdateSlotInput      = z.infer<typeof updateSlotSchema>
export type BulkCreateSlotsInput = z.infer<typeof bulkCreateSlotsSchema>
export type CreateRoomInput      = z.infer<typeof createRoomSchema>
export type UpdateRoomInput      = z.infer<typeof updateRoomSchema>
export type BulkCreateRoomsInput = z.infer<typeof bulkCreateRoomsSchema>
