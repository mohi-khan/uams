import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool }     from 'pg'
import { eq, and } from 'drizzle-orm'
import { tenants }  from './schema/tenants'
import { timeSlots, rooms } from './schema/timetable'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const db   = drizzle(pool)

// ── Slot data ─────────────────────────────────────────────────────────────────
//
//  Slot   Start   End     Duration
//  ─────  ──────  ──────  ────────
//  1      08:00   09:30   90 min
//  2      09:45   11:15   90 min
//  3      11:30   13:00   90 min
//  4      14:00   15:30   90 min
//  5      15:45   17:15   90 min
//  6      17:30   19:00   90 min
//  7      19:15   20:45   90 min   (evening)

const SLOTS = [
  { name: 'Slot 1', startTime: '08:00', endTime: '09:30', durationMinutes: 90 },
  { name: 'Slot 2', startTime: '09:45', endTime: '11:15', durationMinutes: 90 },
  { name: 'Slot 3', startTime: '11:30', endTime: '13:00', durationMinutes: 90 },
  { name: 'Slot 4', startTime: '14:00', endTime: '15:30', durationMinutes: 90 },
  { name: 'Slot 5', startTime: '15:45', endTime: '17:15', durationMinutes: 90 },
  { name: 'Slot 6', startTime: '17:30', endTime: '19:00', durationMinutes: 90 },
  { name: 'Slot 7', startTime: '19:15', endTime: '20:45', durationMinutes: 90 },
]

// ── Room data ─────────────────────────────────────────────────────────────────
//
//  Room         Capacity  Type
//  ───────────  ────────  ──────
//  Room 101         50    THEORY
//  Room 102         50    THEORY
//  Room 201         60    THEORY
//  Room 202         60    THEORY
//  Room 301         40    THEORY
//  Seminar Hall    100    THEORY
//  Lab A            30    LAB
//  Lab B            30    LAB
//  Lab C (CS)       25    LAB
//  Lab D (Net)      20    LAB

const ROOMS = [
  { name: 'Room 101',     capacity: 50,  type: 'THEORY' as const },
  { name: 'Room 102',     capacity: 50,  type: 'THEORY' as const },
  { name: 'Room 201',     capacity: 60,  type: 'THEORY' as const },
  { name: 'Room 202',     capacity: 60,  type: 'THEORY' as const },
  { name: 'Room 301',     capacity: 40,  type: 'THEORY' as const },
  { name: 'Seminar Hall', capacity: 100, type: 'THEORY' as const },
  { name: 'Lab A',        capacity: 30,  type: 'LAB'    as const },
  { name: 'Lab B',        capacity: 30,  type: 'LAB'    as const },
  { name: 'CS Lab',       capacity: 25,  type: 'LAB'    as const },
  { name: 'Network Lab',  capacity: 20,  type: 'LAB'    as const },
]

async function main() {
  // Resolve tenant
  const [tenant] = await db
    .select({ id: tenants.id, name: tenants.name })
    .from(tenants)
    .where(eq(tenants.isActive, true))
    .limit(1)
  if (!tenant) throw new Error('No active tenant found.')
  console.log(`Tenant : ${tenant.name} (${tenant.id})`)

  // ── Slots ──────────────────────────────────────────────────────────────────
  const existingSlots = await db
    .select({ name: timeSlots.name })
    .from(timeSlots)
    .where(eq(timeSlots.tenantId, tenant.id))
  const existingSlotNames = new Set(existingSlots.map(s => s.name))

  const newSlots = SLOTS.filter(s => !existingSlotNames.has(s.name))
  if (newSlots.length === 0) {
    console.log('\nSlots  : all already exist — skipping.')
  } else {
    await db.insert(timeSlots).values(
      newSlots.map(s => ({ ...s, tenantId: tenant.id, isActive: true }))
    )
    console.log(`\nSlots  : inserted ${newSlots.length}`)
    newSlots.forEach(s =>
      console.log(`  + ${s.name.padEnd(8)} ${s.startTime} – ${s.endTime}  (${s.durationMinutes} min)`)
    )
  }

  // ── Rooms ──────────────────────────────────────────────────────────────────
  const existingRooms = await db
    .select({ name: rooms.name })
    .from(rooms)
    .where(eq(rooms.tenantId, tenant.id))
  const existingRoomNames = new Set(existingRooms.map(r => r.name))

  const newRooms = ROOMS.filter(r => !existingRoomNames.has(r.name))
  if (newRooms.length === 0) {
    console.log('\nRooms  : all already exist — skipping.')
  } else {
    await db.insert(rooms).values(
      newRooms.map(r => ({ ...r, tenantId: tenant.id, isActive: true }))
    )
    console.log(`\nRooms  : inserted ${newRooms.length}`)
    newRooms.forEach(r =>
      console.log(`  + ${r.name.padEnd(16)} cap ${String(r.capacity).padStart(3)}  [${r.type}]`)
    )
  }

  console.log(`
Timetable seed complete.
  Slots : ${SLOTS.length} total (${newSlots?.length ?? 0} new)
  Rooms : ${ROOMS.length} total (${newRooms?.length ?? 0} new)
`)

  await pool.end()
}

main().catch(e => { console.error('Seed failed:', e.message); process.exit(1) })
