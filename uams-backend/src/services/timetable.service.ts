import { eq, and, ilike, asc } from 'drizzle-orm'
import { db } from '../lib/db'
import { timeSlots, rooms } from '../db/schema/timetable'
import type {
  CreateSlotInput, UpdateSlotInput,
  CreateRoomInput, UpdateRoomInput,
} from '../lib/validators/timetable.validator'

// ── Time Slots ────────────────────────────────────────────────────────────────

export async function listSlots(tenantId: string, activeOnly = false) {
  const conditions = [eq(timeSlots.tenantId, tenantId)]
  if (activeOnly) conditions.push(eq(timeSlots.isActive, true))
  return db
    .select()
    .from(timeSlots)
    .where(and(...conditions))
    .orderBy(asc(timeSlots.startTime), asc(timeSlots.name))
}

export async function createSlot(tenantId: string, input: CreateSlotInput) {
  const [slot] = await db
    .insert(timeSlots)
    .values({ tenantId, ...input })
    .returning()
  return slot
}

export async function updateSlot(tenantId: string, id: string, input: UpdateSlotInput) {
  const [slot] = await db
    .update(timeSlots)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(timeSlots.id, id), eq(timeSlots.tenantId, tenantId)))
    .returning()
  if (!slot) throw new Error('Slot not found.')
  return slot
}

export async function deleteSlot(tenantId: string, id: string) {
  const [slot] = await db
    .delete(timeSlots)
    .where(and(eq(timeSlots.id, id), eq(timeSlots.tenantId, tenantId)))
    .returning({ id: timeSlots.id })
  if (!slot) throw new Error('Slot not found.')
  return { success: true }
}

export async function bulkUpsertSlots(tenantId: string, rows: CreateSlotInput[]) {
  const values = rows.map(r => ({ tenantId, ...r }))
  const inserted = await db
    .insert(timeSlots)
    .values(values)
    .onConflictDoUpdate({
      target: [timeSlots.tenantId, timeSlots.name],
      set: {
        startTime:       timeSlots.startTime,
        endTime:         timeSlots.endTime,
        durationMinutes: timeSlots.durationMinutes,
        isActive:        timeSlots.isActive,
        updatedAt:       new Date(),
      },
    })
    .returning()
  return inserted
}

// ── Rooms ─────────────────────────────────────────────────────────────────────

export async function listRooms(tenantId: string, activeOnly = false, type?: 'THEORY' | 'LAB') {
  const conditions = [eq(rooms.tenantId, tenantId)]
  if (activeOnly) conditions.push(eq(rooms.isActive, true))
  if (type)       conditions.push(eq(rooms.type, type))
  return db
    .select()
    .from(rooms)
    .where(and(...conditions))
    .orderBy(asc(rooms.type), asc(rooms.name))
}

export async function createRoom(tenantId: string, input: CreateRoomInput) {
  const [room] = await db
    .insert(rooms)
    .values({ tenantId, ...input })
    .returning()
  return room
}

export async function updateRoom(tenantId: string, id: string, input: UpdateRoomInput) {
  const [room] = await db
    .update(rooms)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(rooms.id, id), eq(rooms.tenantId, tenantId)))
    .returning()
  if (!room) throw new Error('Room not found.')
  return room
}

export async function deleteRoom(tenantId: string, id: string) {
  const [room] = await db
    .delete(rooms)
    .where(and(eq(rooms.id, id), eq(rooms.tenantId, tenantId)))
    .returning({ id: rooms.id })
  if (!room) throw new Error('Room not found.')
  return { success: true }
}

export async function bulkUpsertRooms(tenantId: string, rows: CreateRoomInput[]) {
  const values = rows.map(r => ({ tenantId, ...r }))
  const inserted = await db
    .insert(rooms)
    .values(values)
    .onConflictDoUpdate({
      target: [rooms.tenantId, rooms.name],
      set: {
        capacity:  rooms.capacity,
        type:      rooms.type,
        isActive:  rooms.isActive,
        updatedAt: new Date(),
      },
    })
    .returning()
  return inserted
}
