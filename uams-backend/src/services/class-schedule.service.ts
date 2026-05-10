import { eq, and, isNull, desc, sql, count } from 'drizzle-orm'
import { db } from '../lib/db'
import { classSchedules, classScheduleAuditLogs } from '../db/schema/class-schedule'
import { courseOfferings }                         from '../db/schema/scheduling'
import { courses, teachers }                       from '../db/schema/academic'
import { batches }                                 from '../db/schema/enrollment'
import { timeSlots, rooms }                        from '../db/schema/timetable'
import { syllabusTopics }                          from '../db/schema/syllabus'
import type { BulkCreateSchedulesInput, CheckConflictsInput, UpdateScheduleInput } from '../lib/validators/class-schedule.validator'

// ── Pending routine count ─────────────────────────────────────────────────────
// Returns count of course_offerings that have no class_schedules at all.

export async function getPendingRoutineCount(tenantId: string): Promise<number> {
  const result = await db.execute(sql`
    SELECT COUNT(DISTINCT co.id)::int AS cnt
    FROM   course_offerings co
    LEFT JOIN class_schedules cs
           ON cs.course_offering_id = co.id
          AND cs.tenant_id          = co.tenant_id
          AND cs.deleted_at IS NULL
    WHERE  co.tenant_id  = ${tenantId}
      AND  co.deleted_at IS NULL
      AND  cs.id IS NULL
  `)
  return (result.rows[0] as any).cnt ?? 0
}

// ── List offerings for routine builder ───────────────────────────────────────
// Returns course offerings enriched with course/batch/teacher info + whether routine exists.

export async function listOfferingsForRoutine(tenantId: string) {
  const rows = await db.execute(sql`
    SELECT
      co.id                  AS offering_id,
      co.deleted_at          AS offering_deleted_at,
      c.id                   AS course_id,
      c.code                 AS course_code,
      c.title                AS course_title,
      b.id                   AS batch_id,
      b.name                 AS batch_name,
      t.id                   AS teacher_id,
      u.first_name || ' ' || u.last_name AS teacher_name,
      EXISTS (
        SELECT 1 FROM class_schedules cs
        WHERE  cs.course_offering_id = co.id
          AND  cs.tenant_id          = co.tenant_id
          AND  cs.deleted_at IS NULL
      ) AS has_routine
    FROM   course_offerings co
    JOIN   courses  c  ON c.id = co.course_id
    LEFT JOIN batches   b  ON b.id = co.batch_id
    LEFT JOIN teachers  t  ON t.id = co.teacher_id
    LEFT JOIN users     u  ON u.id = t.user_id
    WHERE  co.tenant_id  = ${tenantId}
      AND  co.deleted_at IS NULL
    ORDER BY c.code, b.name NULLS LAST
  `)
  return rows.rows as Array<{
    offering_id:    string
    course_id:      string
    course_code:    string
    course_title:   string
    batch_id:       string | null
    batch_name:     string | null
    teacher_id:     string | null
    teacher_name:   string | null
    has_routine:    boolean
  }>
}

// ── Conflict detection ────────────────────────────────────────────────────────
//
// For each (sessionDate, timeSlotId) pair in the input rows, checks whether an
// existing SCHEDULED/COMPLETED/RESCHEDULED class already occupies:
//   • the same room
//   • the same teacher
//   • the same batch
// belonging to a DIFFERENT course offering than the one being scheduled.
//
// Returns an array of conflict objects; empty array = no conflicts.

export interface ScheduleConflict {
  sessionDate:    string
  timeSlotId:     string
  conflictType:   'ROOM' | 'TEACHER' | 'BATCH'
  existingCourse: string          // "CSE101 — Fundamentals…"
  existingOffering: string
}

export async function checkConflicts(
  tenantId: string,
  input:    CheckConflictsInput,
): Promise<ScheduleConflict[]> {
  // Resolve offering to get teacherId, batchId
  const [offering] = await db
    .select({
      courseId:  courseOfferings.courseId,
      teacherId: courseOfferings.teacherId,
      batchId:   courseOfferings.batchId,
    })
    .from(courseOfferings)
    .where(and(
      eq(courseOfferings.id, input.courseOfferingId),
      eq(courseOfferings.tenantId, tenantId),
      isNull(courseOfferings.deletedAt),
    ))
    .limit(1)
  if (!offering) throw new Error('Course offering not found.')

  const dates     = input.rows.map(r => r.sessionDate)
  const slotIds   = [...new Set(input.rows.map(r => r.timeSlotId))]
  const roomIds   = [...new Set(input.rows.map(r => r.roomId).filter(Boolean))] as string[]
  const teacherId = offering.teacherId
  const batchId   = offering.batchId

  if (dates.length === 0) return []

  // Single query — fetch all potential conflicts on any of the input dates+slots
  const result = await db.execute(sql`
    SELECT
      cs.session_date::text  AS session_date,
      cs.time_slot_id::text  AS time_slot_id,
      cs.room_id::text       AS room_id,
      cs.teacher_id::text    AS teacher_id,
      cs.batch_id::text      AS batch_id,
      cs.course_offering_id::text AS existing_offering_id,
      c.code || ' — ' || c.title AS course_label
    FROM   class_schedules cs
    JOIN   course_offerings co2 ON co2.id = cs.course_offering_id
    JOIN   courses           c  ON c.id   = co2.course_id
    WHERE  cs.tenant_id           = ${tenantId}
      AND  cs.deleted_at         IS NULL
      AND  cs.status             != 'CANCELLED'
      AND  cs.course_offering_id != ${input.courseOfferingId}
      AND  cs.session_date        = ANY(ARRAY[${sql.join(dates.map(d => sql`${d}::date`), sql`, `)}])
      AND  cs.time_slot_id        = ANY(ARRAY[${sql.join(slotIds.map(id => sql`${id}::uuid`), sql`, `)}])
      AND (
        ${roomIds.length > 0
          ? sql`(cs.room_id IS NOT NULL AND cs.room_id = ANY(ARRAY[${sql.join(roomIds.map(id => sql`${id}::uuid`), sql`, `)}]))`
          : sql`false`}
        OR ${teacherId
          ? sql`(cs.teacher_id IS NOT NULL AND cs.teacher_id = ${teacherId}::uuid)`
          : sql`false`}
        OR ${batchId
          ? sql`(cs.batch_id IS NOT NULL AND cs.batch_id = ${batchId}::uuid)`
          : sql`false`}
      )
  `)

  const rawRows = result.rows as Array<{
    session_date: string; time_slot_id: string; room_id: string | null
    teacher_id: string | null; batch_id: string | null
    existing_offering_id: string; course_label: string
  }>

  const conflicts: ScheduleConflict[] = []

  for (const row of rawRows) {
    // Match back against the input rows by (date, slotId)
    const inputRow = input.rows.find(
      r => r.sessionDate === row.session_date && r.timeSlotId === row.time_slot_id
    )
    if (!inputRow) continue

    if (row.room_id && inputRow.roomId === row.room_id) {
      conflicts.push({ sessionDate: row.session_date, timeSlotId: row.time_slot_id, conflictType: 'ROOM', existingCourse: row.course_label, existingOffering: row.existing_offering_id })
    }
    if (teacherId && row.teacher_id === teacherId) {
      conflicts.push({ sessionDate: row.session_date, timeSlotId: row.time_slot_id, conflictType: 'TEACHER', existingCourse: row.course_label, existingOffering: row.existing_offering_id })
    }
    if (batchId && row.batch_id === batchId) {
      conflicts.push({ sessionDate: row.session_date, timeSlotId: row.time_slot_id, conflictType: 'BATCH', existingCourse: row.course_label, existingOffering: row.existing_offering_id })
    }
  }

  return conflicts
}

// ── Bulk create schedules ─────────────────────────────────────────────────────

export async function bulkCreateSchedules(
  tenantId:    string,
  performedBy: string,
  input:       BulkCreateSchedulesInput,
) {
  // Resolve offering → pull courseId, teacherId, batchId, section
  const [offering] = await db
    .select({
      courseId:  courseOfferings.courseId,
      teacherId: courseOfferings.teacherId,
      batchId:   courseOfferings.batchId,
    })
    .from(courseOfferings)
    .where(and(
      eq(courseOfferings.id, input.courseOfferingId),
      eq(courseOfferings.tenantId, tenantId),
      isNull(courseOfferings.deletedAt),
    ))
    .limit(1)
  if (!offering) throw new Error('Course offering not found.')

  // Server-side conflict guard — reject if any conflicts exist
  const conflicts = await checkConflicts(tenantId, {
    courseOfferingId: input.courseOfferingId,
    rows: input.rows.map(r => ({
      sessionDate: r.sessionDate,
      dayOfWeek:   r.dayOfWeek,
      timeSlotId:  r.timeSlotId,
      roomId:      r.roomId ?? null,
    })),
  })
  if (conflicts.length > 0) {
    const summary = conflicts.map(c =>
      `${c.conflictType} conflict on ${c.sessionDate} slot ${c.timeSlotId} with ${c.existingCourse}`
    ).join('; ')
    throw new Error(`Schedule conflicts detected: ${summary}`)
  }

  const values = input.rows.map(row => ({
    tenantId,
    courseOfferingId: input.courseOfferingId,
    courseId:         offering.courseId,
    teacherId:        offering.teacherId ?? null,
    batchId:          offering.batchId ?? null,
    sessionDate:      row.sessionDate,
    dayOfWeek:        row.dayOfWeek,
    timeSlotId:       row.timeSlotId,
    roomId:           row.roomId ?? null,
    syllabusTopicId:  row.syllabusTopicId ?? null,
    topicId:          row.topicId ?? null,
    isMakeupClass:    row.isMakeupClass ?? false,
    notes:            row.notes ?? null,
    status:           'SCHEDULED' as const,
    createdBy:        performedBy,
    updatedBy:        performedBy,
  }))

  // Wrap insert + audit in a transaction so the unique-index violation from a
  // concurrent insert surfaces cleanly as a 23505 error rather than partial writes.
  try {
    return await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(classSchedules)
        .values(values)
        .returning()

      if (inserted.length > 0) {
        await tx.insert(classScheduleAuditLogs).values(
          inserted.map(s => ({
            tenantId,
            scheduleId:  s.id,
            action:      'CREATE' as const,
            performedBy,
            snapshot:    { sessionDate: s.sessionDate, timeSlotId: s.timeSlotId } as any,
          }))
        )
      }

      return inserted
    })
  } catch (err: any) {
    // PostgreSQL unique-violation — two coordinators submitted overlapping schedules simultaneously
    if (err.code === '23505') {
      const c = err.constraint ?? ''
      if (c.includes('room'))    throw new Error('Room double-booking detected: another schedule was saved at the same time. Please re-check conflicts and try again.')
      if (c.includes('teacher')) throw new Error('Teacher double-booking detected: another schedule was saved at the same time. Please re-check conflicts and try again.')
      if (c.includes('batch'))   throw new Error('Batch double-booking detected: another schedule was saved at the same time. Please re-check conflicts and try again.')
      throw new Error('A scheduling conflict was detected at the database level. Please re-check conflicts and try again.')
    }
    throw err
  }
}

// ── List schedules for an offering ───────────────────────────────────────────

export async function listSchedulesByOffering(tenantId: string, courseOfferingId: string) {
  return db
    .select({
      id:              classSchedules.id,
      sessionDate:     classSchedules.sessionDate,
      dayOfWeek:       classSchedules.dayOfWeek,
      status:          classSchedules.status,
      isMakeupClass:   classSchedules.isMakeupClass,
      notes:           classSchedules.notes,
      timeSlotId:      classSchedules.timeSlotId,
      slotName:        timeSlots.name,
      slotStart:       timeSlots.startTime,
      slotEnd:         timeSlots.endTime,
      roomId:          classSchedules.roomId,
      roomName:        rooms.name,
      syllabusTopicId: classSchedules.syllabusTopicId,
    })
    .from(classSchedules)
    .leftJoin(timeSlots, eq(timeSlots.id, classSchedules.timeSlotId))
    .leftJoin(rooms,     eq(rooms.id,     classSchedules.roomId))
    .where(and(
      eq(classSchedules.tenantId, tenantId),
      eq(classSchedules.courseOfferingId, courseOfferingId),
      isNull(classSchedules.deletedAt),
    ))
    .orderBy(classSchedules.sessionDate)
}

// ── Update a single schedule ──────────────────────────────────────────────────

export async function updateSchedule(
  tenantId:    string,
  id:          string,
  performedBy: string,
  input:       UpdateScheduleInput,
) {
  const [before] = await db
    .select()
    .from(classSchedules)
    .where(and(eq(classSchedules.id, id), eq(classSchedules.tenantId, tenantId), isNull(classSchedules.deletedAt)))
    .limit(1)
  if (!before) throw new Error('Schedule not found.')

  const [updated] = await db
    .update(classSchedules)
    .set({ ...input, updatedBy: performedBy, updatedAt: new Date() })
    .where(and(eq(classSchedules.id, id), eq(classSchedules.tenantId, tenantId)))
    .returning()

  await db.insert(classScheduleAuditLogs).values({
    tenantId,
    scheduleId:  id,
    action:      'UPDATE' as const,
    performedBy,
    snapshot:    { before, after: input } as any,
  })

  return updated
}

// ── Cancel a schedule ─────────────────────────────────────────────────────────

export async function cancelSchedule(tenantId: string, id: string, performedBy: string) {
  const [updated] = await db
    .update(classSchedules)
    .set({ status: 'CANCELLED', deletedAt: new Date(), deletedBy: performedBy, updatedAt: new Date() })
    .where(and(eq(classSchedules.id, id), eq(classSchedules.tenantId, tenantId), isNull(classSchedules.deletedAt)))
    .returning({ id: classSchedules.id })
  if (!updated) throw new Error('Schedule not found.')

  await db.insert(classScheduleAuditLogs).values({
    tenantId,
    scheduleId:  id,
    action:      'DELETE' as const,
    performedBy,
    snapshot:    null,
  })

  return { success: true }
}

// ── Student: full schedule (all enrolled-batch courses) ──────────────────────

export async function getStudentSchedule(tenantId: string, userId: string) {
  const result = await db.execute(sql`
    SELECT
      cs.id,
      cs.session_date::text       AS session_date,
      cs.day_of_week,
      cs.status,
      cs.is_makeup_class,
      cs.notes,
      cs.course_offering_id,
      cs.syllabus_topic_id,
      c.id                        AS course_id,
      c.code                      AS course_code,
      c.title                     AS course_title,
      b.name                      AS batch_name,
      ts.name                     AS slot_name,
      ts.start_time               AS slot_start,
      ts.end_time                 AS slot_end,
      r.name                      AS room_name,
      st.title                    AS topic_title
    FROM   class_schedules    cs
    JOIN   course_offerings   co  ON co.id  = cs.course_offering_id
    JOIN   courses             c  ON c.id   = cs.course_id
    LEFT JOIN batches          b  ON b.id   = cs.batch_id
    LEFT JOIN time_slots      ts  ON ts.id  = cs.time_slot_id
    LEFT JOIN rooms            r  ON r.id   = cs.room_id
    LEFT JOIN syllabus_topics st  ON st.id  = cs.syllabus_topic_id
    WHERE  cs.tenant_id  = ${tenantId}
      AND  cs.deleted_at IS NULL
      AND  cs.status    != 'CANCELLED'
      AND  cs.batch_id  IN (
             SELECT se.batch_id
             FROM   student_enrollments se
             JOIN   students            s  ON s.id     = se.student_id
             JOIN   users               u  ON u.email  = s.gmail_account
             WHERE  u.id         = ${userId}::uuid
               AND  se.tenant_id = ${tenantId}
               AND  se.deleted_at IS NULL
               AND  se.batch_id IS NOT NULL
           )
    ORDER  BY cs.session_date ASC, ts.start_time ASC NULLS LAST
  `)
  return result.rows as Array<{
    id:                 string
    session_date:       string
    day_of_week:        string
    status:             string
    is_makeup_class:    boolean
    notes:              string | null
    course_offering_id: string
    syllabus_topic_id:  string | null
    course_id:          string
    course_code:        string
    course_title:       string
    batch_name:         string | null
    slot_name:          string | null
    slot_start:         string | null
    slot_end:           string | null
    room_name:          string | null
    topic_title:        string | null
  }>
}

// ── Student: tomorrow's classes only ─────────────────────────────────────────

export async function getStudentUpcomingTomorrow(tenantId: string, userId: string) {
  const result = await db.execute(sql`
    SELECT
      cs.id,
      cs.session_date::text       AS session_date,
      cs.day_of_week,
      cs.status,
      cs.is_makeup_class,
      cs.notes,
      cs.course_offering_id,
      cs.syllabus_topic_id,
      c.id                        AS course_id,
      c.code                      AS course_code,
      c.title                     AS course_title,
      b.name                      AS batch_name,
      ts.name                     AS slot_name,
      ts.start_time               AS slot_start,
      ts.end_time                 AS slot_end,
      r.name                      AS room_name,
      st.title                    AS topic_title
    FROM   class_schedules    cs
    JOIN   course_offerings   co  ON co.id  = cs.course_offering_id
    JOIN   courses             c  ON c.id   = cs.course_id
    LEFT JOIN batches          b  ON b.id   = cs.batch_id
    LEFT JOIN time_slots      ts  ON ts.id  = cs.time_slot_id
    LEFT JOIN rooms            r  ON r.id   = cs.room_id
    LEFT JOIN syllabus_topics st  ON st.id  = cs.syllabus_topic_id
    WHERE  cs.tenant_id    = ${tenantId}
      AND  cs.deleted_at  IS NULL
      AND  cs.status      != 'CANCELLED'
      AND  cs.session_date = (CURRENT_DATE + INTERVAL '1 day')::date
      AND  cs.batch_id    IN (
             SELECT se.batch_id
             FROM   student_enrollments se
             JOIN   students            s  ON s.id     = se.student_id
             JOIN   users               u  ON u.email  = s.gmail_account
             WHERE  u.id         = ${userId}::uuid
               AND  se.tenant_id = ${tenantId}
               AND  se.deleted_at IS NULL
               AND  se.batch_id IS NOT NULL
           )
    ORDER  BY ts.start_time ASC NULLS LAST
  `)
  return result.rows as Array<{
    id:                 string
    session_date:       string
    day_of_week:        string
    status:             string
    is_makeup_class:    boolean
    notes:              string | null
    course_offering_id: string
    syllabus_topic_id:  string | null
    course_id:          string
    course_code:        string
    course_title:       string
    batch_name:         string | null
    slot_name:          string | null
    slot_start:         string | null
    slot_end:           string | null
    room_name:          string | null
    topic_title:        string | null
  }>
}

// ── Teacher: upcoming classes ─────────────────────────────────────────────────

export async function getMyUpcomingClasses(tenantId: string, userId: string) {
  // Resolve teacher from userId
  const [teacher] = await db
    .select({ id: teachers.id })
    .from(teachers)
    .where(and(eq(teachers.userId, userId), eq(teachers.tenantId, tenantId)))
    .limit(1)
  if (!teacher) throw new Error('Teacher record not found.')

  const today = new Date().toISOString().split('T')[0]

  const result = await db.execute(sql`
    SELECT
      cs.id,
      cs.session_date::text  AS session_date,
      cs.day_of_week,
      cs.status,
      cs.is_makeup_class,
      cs.notes,
      cs.course_offering_id,
      cs.syllabus_topic_id,
      c.id                                    AS course_id,
      c.code                                  AS course_code,
      c.title                                 AS course_title,
      b.name                                  AS batch_name,
      ts.name                                 AS slot_name,
      ts.start_time                           AS slot_start,
      ts.end_time                             AS slot_end,
      r.name                                  AS room_name,
      st.title                                AS topic_title
    FROM   class_schedules  cs
    JOIN   course_offerings co ON co.id  = cs.course_offering_id
    JOIN   courses           c  ON c.id  = cs.course_id
    LEFT JOIN batches        b  ON b.id  = cs.batch_id
    LEFT JOIN time_slots    ts  ON ts.id = cs.time_slot_id
    LEFT JOIN rooms          r  ON r.id  = cs.room_id
    LEFT JOIN syllabus_topics st ON st.id = cs.syllabus_topic_id
    WHERE  cs.tenant_id  = ${tenantId}
      AND  cs.teacher_id = ${teacher.id}::uuid
      AND  cs.deleted_at IS NULL
      AND  cs.status    != 'CANCELLED'
      AND  cs.session_date >= ${today}::date
    ORDER  BY cs.session_date ASC, ts.start_time ASC
    LIMIT  10
  `)

  return result.rows as Array<{
    id:                  string
    session_date:        string
    day_of_week:         string
    status:              string
    is_makeup_class:     boolean
    notes:               string | null
    course_offering_id:  string
    syllabus_topic_id:   string | null
    course_id:           string
    course_code:         string
    course_title:        string
    batch_name:          string | null
    slot_name:           string | null
    slot_start:          string | null
    slot_end:            string | null
    room_name:           string | null
    topic_title:         string | null
  }>
}
