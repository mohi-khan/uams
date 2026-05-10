import { eq, and, ilike, isNull, count, desc, sql, or, inArray } from 'drizzle-orm'
import { db } from '../lib/db'
import {
  studentEnrollments, enrollmentAuditLogs,
  studentSemesters,   semesterAuditLogs,
  studentInstallments,installmentAuditLogs,
  studentPayments,
  programOfferings,
} from '../db/schema/student-enrollment'
import { programs, academicSessions } from '../db/schema/academic'
import { students, batches }           from '../db/schema/enrollment'
import { semesterOfferings }           from '../db/schema/scheduling'
import { users }                        from '../db/schema/users'
import type {
  CreateEnrollmentInput, UpdateEnrollmentInput,
  AddSemesterInput, UpdateSemesterInput,
  RecordPaymentInput, UpdateInstallmentInput,
} from '../lib/validators/enrollment-txn.validator'

// ── Enrollments ───────────────────────────────────────────────────────────────

export async function listEnrollments(
  tenantId: string,
  page = 1, limit = 20,
  opts: { search?: string; programId?: string; status?: string; studentId?: string } = {},
) {
  const offset = (page - 1) * limit
  const conds: any[] = [eq(studentEnrollments.tenantId, tenantId), isNull(studentEnrollments.deletedAt)]
  if (opts.programId) conds.push(eq(studentEnrollments.programId, opts.programId))
  if (opts.status)    conds.push(eq(studentEnrollments.status, opts.status as any))
  if (opts.studentId) conds.push(eq(studentEnrollments.studentId, opts.studentId))
  if (opts.search)    conds.push(or(
    ilike(students.name,        `%${opts.search}%`),
    ilike(students.studentCode, `%${opts.search}%`),
  )!)
  const where = and(...conds)

  const offeringSessions = db
    .select({ id: programOfferings.id, sessionId: programOfferings.academicSessionId })
    .from(programOfferings)
    .as('offering_sessions')

  const [rows, [{ total }]] = await Promise.all([
    db.select({
      id:                studentEnrollments.id,
      studentId:         studentEnrollments.studentId,
      studentName:       students.name,
      studentCode:       students.studentCode,
      studentPhoto:      students.photoUrl,
      programId:         studentEnrollments.programId,
      programName:       programs.name,
      programCode:       programs.code,
      programOfferingId: studentEnrollments.programOfferingId,
      batchId:           studentEnrollments.batchId,
      batchName:         batches.name,
      sessionId:         offeringSessions.sessionId,
      sessionName:       academicSessions.name,
      enrollmentDate:    studentEnrollments.enrollmentDate,
      status:            studentEnrollments.status,
      totalFee:          studentEnrollments.totalFee,
      paidAmount:        studentEnrollments.paidAmount,
      notes:             studentEnrollments.notes,
      createdAt:         studentEnrollments.createdAt,
    })
    .from(studentEnrollments)
    .innerJoin(students,          eq(studentEnrollments.studentId,        students.id))
    .innerJoin(programs,          eq(studentEnrollments.programId,        programs.id))
    .leftJoin(batches,            eq(studentEnrollments.batchId,          batches.id))
    .leftJoin(offeringSessions,   eq(studentEnrollments.programOfferingId, offeringSessions.id))
    .leftJoin(academicSessions,   eq(offeringSessions.sessionId,          academicSessions.id))
    .where(where)
    .orderBy(desc(studentEnrollments.createdAt))
    .limit(limit).offset(offset),

    db.select({ total: count() })
    .from(studentEnrollments)
    .innerJoin(students, eq(studentEnrollments.studentId, students.id))
    .where(where),
  ])

  return { data: rows, total: Number(total), page, limit }
}

export async function createEnrollment(
  tenantId: string, performedBy: string, input: CreateEnrollmentInput,
) {
  return db.transaction(async (tx) => {
    // Resolve the offering to get programId + sessionId
    const [offering] = await tx
      .select({
        id:               programOfferings.id,
        programId:        programOfferings.programId,
        academicSessionId: programOfferings.academicSessionId,
        status:           programOfferings.status,
        capacity:         programOfferings.capacity,
      })
      .from(programOfferings)
      .where(and(
        eq(programOfferings.id,       input.programOfferingId),
        eq(programOfferings.tenantId, tenantId),
        isNull(programOfferings.deletedAt),
      ))
      .limit(1)

    if (!offering) throw new Error('Program offering not found.')
    if (offering.status === 'closed') throw new Error('This program offering is closed for admissions.')

    // Capacity check
    if (offering.capacity != null) {
      const [{ enrolled }] = await tx
        .select({ enrolled: count() })
        .from(studentEnrollments)
        .where(and(
          eq(studentEnrollments.programOfferingId, offering.id),
          eq(studentEnrollments.tenantId,          tenantId),
          isNull(studentEnrollments.deletedAt),
        ))
      if (Number(enrolled) >= offering.capacity) {
        throw new Error(`This offering has reached its capacity of ${offering.capacity}.`)
      }
    }

    // Duplicate check: same student + same offering
    const [dup] = await tx
      .select({ id: studentEnrollments.id })
      .from(studentEnrollments)
      .where(and(
        eq(studentEnrollments.tenantId,           tenantId),
        eq(studentEnrollments.studentId,          input.studentId),
        eq(studentEnrollments.programOfferingId,  input.programOfferingId),
        isNull(studentEnrollments.deletedAt),
      ))
      .limit(1)
    if (dup) throw new Error('Student is already enrolled in this offering.')

    const [enrollment] = await tx.insert(studentEnrollments).values({
      tenantId,
      studentId:         input.studentId,
      programOfferingId: input.programOfferingId,
      programId:         offering.programId,
      sessionId:         offering.academicSessionId,
      batchId:           input.batchId        ?? null,
      feeStructureId:    input.feeStructureId ?? null,
      enrollmentDate:    input.enrollmentDate,
      status:            'active',
      totalFee:          String(input.totalFee),
      paidAmount:        '0',
      notes:             input.notes ?? null,
      createdBy:         performedBy,
      updatedBy:         performedBy,
    }).returning()

    if (input.installments?.length) {
      await tx.insert(studentInstallments).values(
        input.installments.map((ins) => ({
          tenantId,
          enrollmentId:  enrollment.id,
          studentId:     input.studentId,
          installmentNo: ins.installmentNo,
          description:   ins.description ?? null,
          dueDate:       ins.dueDate,
          amount:        String(ins.amount),
          paidAmount:    '0',
          status:        'pending' as const,
          createdBy:     performedBy,
          updatedBy:     performedBy,
        }))
      )
    }

    await tx.insert(enrollmentAuditLogs).values({
      tenantId, enrollmentId: enrollment.id, action: 'CREATE', performedBy, snapshot: enrollment as any,
    })

    return enrollment
  })
}

export async function getEnrollmentById(tenantId: string, id: string) {
  const offeringSessions = db
    .select({ id: programOfferings.id, sessionId: programOfferings.academicSessionId })
    .from(programOfferings)
    .as('offering_sessions2')

  const [row] = await db.select({
    id:                studentEnrollments.id,
    studentId:         studentEnrollments.studentId,
    studentName:       students.name,
    studentCode:       students.studentCode,
    studentEmail:      students.email,
    studentPhone:      students.phone,
    studentPhoto:      students.photoUrl,
    programId:         studentEnrollments.programId,
    programName:       programs.name,
    programCode:       programs.code,
    programOfferingId: studentEnrollments.programOfferingId,
    batchId:           studentEnrollments.batchId,
    batchName:         batches.name,
    sessionId:         offeringSessions.sessionId,
    sessionName:       academicSessions.name,
    feeStructureId:    studentEnrollments.feeStructureId,
    enrollmentDate:    studentEnrollments.enrollmentDate,
    status:            studentEnrollments.status,
    totalFee:          studentEnrollments.totalFee,
    paidAmount:        studentEnrollments.paidAmount,
    notes:             studentEnrollments.notes,
    createdAt:         studentEnrollments.createdAt,
    updatedAt:         studentEnrollments.updatedAt,
  })
  .from(studentEnrollments)
  .innerJoin(students,          eq(studentEnrollments.studentId,         students.id))
  .innerJoin(programs,          eq(studentEnrollments.programId,         programs.id))
  .leftJoin(batches,            eq(studentEnrollments.batchId,           batches.id))
  .leftJoin(offeringSessions,   eq(studentEnrollments.programOfferingId, offeringSessions.id))
  .leftJoin(academicSessions,   eq(offeringSessions.sessionId,           academicSessions.id))
  .where(and(eq(studentEnrollments.id, id), eq(studentEnrollments.tenantId, tenantId), isNull(studentEnrollments.deletedAt)))
  .limit(1)

  if (!row) throw new Error('Enrollment not found.')
  return row
}

export async function updateEnrollment(
  tenantId: string, performedBy: string, id: string, input: UpdateEnrollmentInput,
) {
  const [before] = await db
    .select()
    .from(studentEnrollments)
    .where(and(eq(studentEnrollments.id, id), eq(studentEnrollments.tenantId, tenantId), isNull(studentEnrollments.deletedAt)))
    .limit(1)
  if (!before) throw new Error('Enrollment not found.')

  const [after] = await db.update(studentEnrollments)
    .set({
      ...(input.batchId !== undefined && { batchId: input.batchId }),
      ...(input.status  !== undefined && { status:  input.status }),
      ...(input.notes   !== undefined && { notes:   input.notes }),
      updatedBy: performedBy, updatedAt: new Date(),
    })
    .where(and(eq(studentEnrollments.id, id), eq(studentEnrollments.tenantId, tenantId)))
    .returning()

  await db.insert(enrollmentAuditLogs).values({
    tenantId, enrollmentId: id, action: 'UPDATE', performedBy, snapshot: { before, after } as any,
  })

  return after
}

export async function deleteEnrollment(tenantId: string, performedBy: string, id: string) {
  const [existing] = await db
    .select()
    .from(studentEnrollments)
    .where(and(eq(studentEnrollments.id, id), eq(studentEnrollments.tenantId, tenantId), isNull(studentEnrollments.deletedAt)))
    .limit(1)
  if (!existing) throw new Error('Enrollment not found.')

  await db.update(studentEnrollments)
    .set({ deletedAt: new Date(), deletedBy: performedBy, updatedAt: new Date() })
    .where(and(eq(studentEnrollments.id, id), eq(studentEnrollments.tenantId, tenantId)))

  await db.insert(enrollmentAuditLogs).values({
    tenantId, enrollmentId: id, action: 'DELETE', performedBy, snapshot: existing as any,
  })
}

export async function getEnrollmentAuditLogs(tenantId: string, enrollmentId: string) {
  return db
    .select({
      id:              enrollmentAuditLogs.id,
      action:          enrollmentAuditLogs.action,
      performedByName: sql<string>`coalesce(concat(${users.firstName},' ',${users.lastName}),'System')`,
      snapshot:        enrollmentAuditLogs.snapshot,
      createdAt:       enrollmentAuditLogs.createdAt,
    })
    .from(enrollmentAuditLogs)
    .leftJoin(users, eq(enrollmentAuditLogs.performedBy, users.id))
    .where(and(eq(enrollmentAuditLogs.tenantId, tenantId), eq(enrollmentAuditLogs.enrollmentId, enrollmentId)))
    .orderBy(desc(enrollmentAuditLogs.createdAt))
}

// ── Semesters ─────────────────────────────────────────────────────────────────

export async function listSemesters(tenantId: string, enrollmentId: string) {
  return db.select({
    id:          studentSemesters.id,
    semesterNo:  studentSemesters.semesterNo,
    sessionId:   studentSemesters.sessionId,
    sessionName: academicSessions.name,
    startDate:   studentSemesters.startDate,
    endDate:     studentSemesters.endDate,
    status:      studentSemesters.status,
    createdAt:   studentSemesters.createdAt,
  })
  .from(studentSemesters)
  .leftJoin(academicSessions, eq(studentSemesters.sessionId, academicSessions.id))
  .where(and(eq(studentSemesters.enrollmentId, enrollmentId), eq(studentSemesters.tenantId, tenantId)))
  .orderBy(studentSemesters.semesterNo)
}

export async function addSemester(
  tenantId: string, performedBy: string, enrollmentId: string, input: AddSemesterInput,
) {
  const [enrollment] = await db
    .select({ studentId: studentEnrollments.studentId })
    .from(studentEnrollments)
    .where(and(eq(studentEnrollments.id, enrollmentId), eq(studentEnrollments.tenantId, tenantId), isNull(studentEnrollments.deletedAt)))
    .limit(1)
  if (!enrollment) throw new Error('Enrollment not found.')

  const [row] = await db.insert(studentSemesters).values({
    tenantId,
    enrollmentId,
    studentId:  enrollment.studentId,
    semesterNo: input.semesterNo,
    sessionId:  input.sessionId ?? null,
    startDate:  input.startDate ?? null,
    endDate:    input.endDate   ?? null,
    status:     input.status,
    createdBy:  performedBy,
    updatedBy:  performedBy,
  }).returning()

  await db.insert(semesterAuditLogs).values({
    tenantId, semesterId: row.id, action: 'CREATE', performedBy, snapshot: row as any,
  })

  return row
}

export async function updateSemester(
  tenantId: string, performedBy: string, semId: string, input: UpdateSemesterInput,
) {
  const [before] = await db
    .select()
    .from(studentSemesters)
    .where(and(eq(studentSemesters.id, semId), eq(studentSemesters.tenantId, tenantId)))
    .limit(1)
  if (!before) throw new Error('Semester not found.')

  const [after] = await db.update(studentSemesters)
    .set({
      ...(input.sessionId !== undefined && { sessionId: input.sessionId }),
      ...(input.startDate !== undefined && { startDate: input.startDate }),
      ...(input.endDate   !== undefined && { endDate:   input.endDate }),
      ...(input.status    !== undefined && { status:    input.status }),
      updatedBy: performedBy, updatedAt: new Date(),
    })
    .where(and(eq(studentSemesters.id, semId), eq(studentSemesters.tenantId, tenantId)))
    .returning()

  await db.insert(semesterAuditLogs).values({
    tenantId, semesterId: semId, action: 'UPDATE', performedBy, snapshot: { before, after } as any,
  })

  return after
}

// ── Installments ──────────────────────────────────────────────────────────────

export async function listInstallments(tenantId: string, enrollmentId: string) {
  return db.select()
    .from(studentInstallments)
    .where(and(eq(studentInstallments.enrollmentId, enrollmentId), eq(studentInstallments.tenantId, tenantId)))
    .orderBy(studentInstallments.installmentNo)
}

export async function updateInstallment(
  tenantId: string, performedBy: string, instId: string, input: UpdateInstallmentInput,
) {
  const [before] = await db
    .select()
    .from(studentInstallments)
    .where(and(eq(studentInstallments.id, instId), eq(studentInstallments.tenantId, tenantId)))
    .limit(1)
  if (!before) throw new Error('Installment not found.')

  const [after] = await db.update(studentInstallments)
    .set({
      ...(input.status  !== undefined && { status:  input.status }),
      ...(input.dueDate !== undefined && { dueDate: input.dueDate }),
      updatedBy: performedBy, updatedAt: new Date(),
    })
    .where(and(eq(studentInstallments.id, instId), eq(studentInstallments.tenantId, tenantId)))
    .returning()

  await db.insert(installmentAuditLogs).values({
    tenantId, installmentId: instId, action: 'UPDATE', performedBy, snapshot: { before, after } as any,
  })

  return after
}

// ── Payments ──────────────────────────────────────────────────────────────────

export async function listPayments(tenantId: string, enrollmentId: string) {
  return db.select({
    id:             studentPayments.id,
    installmentId:  studentPayments.installmentId,
    amount:         studentPayments.amount,
    paymentDate:    studentPayments.paymentDate,
    paymentMethod:  studentPayments.paymentMethod,
    transactionRef: studentPayments.transactionRef,
    notes:          studentPayments.notes,
    createdByName:  sql<string>`coalesce(concat(${users.firstName},' ',${users.lastName}),'System')`,
    createdAt:      studentPayments.createdAt,
  })
  .from(studentPayments)
  .leftJoin(users, eq(studentPayments.createdBy, users.id))
  .where(and(eq(studentPayments.enrollmentId, enrollmentId), eq(studentPayments.tenantId, tenantId)))
  .orderBy(desc(studentPayments.createdAt))
}

export async function recordPayment(
  tenantId: string, performedBy: string, enrollmentId: string, input: RecordPaymentInput,
) {
  return db.transaction(async (tx) => {
    const [enrollment] = await tx
      .select({ id: studentEnrollments.id, studentId: studentEnrollments.studentId, paidAmount: studentEnrollments.paidAmount })
      .from(studentEnrollments)
      .where(and(eq(studentEnrollments.id, enrollmentId), eq(studentEnrollments.tenantId, tenantId), isNull(studentEnrollments.deletedAt)))
      .limit(1)
    if (!enrollment) throw new Error('Enrollment not found.')

    const [payment] = await tx.insert(studentPayments).values({
      tenantId,
      enrollmentId,
      studentId:      enrollment.studentId,
      installmentId:  input.installmentId ?? null,
      amount:         String(input.amount),
      paymentDate:    input.paymentDate,
      paymentMethod:  input.paymentMethod,
      transactionRef: input.transactionRef ?? null,
      notes:          input.notes ?? null,
      createdBy:      performedBy,
    }).returning()

    if (input.installmentId) {
      const [inst] = await tx
        .select({ amount: studentInstallments.amount, paidAmount: studentInstallments.paidAmount })
        .from(studentInstallments)
        .where(and(eq(studentInstallments.id, input.installmentId), eq(studentInstallments.tenantId, tenantId)))
        .limit(1)

      if (inst) {
        const newPaid   = Number(inst.paidAmount) + input.amount
        const newStatus = newPaid >= Number(inst.amount) ? 'paid' : 'pending'
        await tx.update(studentInstallments)
          .set({ paidAmount: String(newPaid), status: newStatus as any, updatedBy: performedBy, updatedAt: new Date() })
          .where(eq(studentInstallments.id, input.installmentId))
      }
    }

    const newEnrolPaid = Number(enrollment.paidAmount) + input.amount
    await tx.update(studentEnrollments)
      .set({ paidAmount: String(newEnrolPaid), updatedBy: performedBy, updatedAt: new Date() })
      .where(and(eq(studentEnrollments.id, enrollmentId), eq(studentEnrollments.tenantId, tenantId)))

    return payment
  })
}

// ── Batch Assignment ──────────────────────────────────────────────────────────

export async function getEnrollmentsBySemesterOffering(tenantId: string, semesterOfferingId: string) {
  const [semOff] = await db
    .select({ id: semesterOfferings.id, programId: semesterOfferings.programId, sessionId: semesterOfferings.sessionId })
    .from(semesterOfferings)
    .where(and(eq(semesterOfferings.id, semesterOfferingId), eq(semesterOfferings.tenantId, tenantId)))
    .limit(1)

  if (!semOff) throw new Error('Semester offering not found.')

  const rows = await db
    .select({
      id:             studentEnrollments.id,
      studentId:      studentEnrollments.studentId,
      studentName:    students.name,
      studentCode:    students.studentCode,
      studentPhoto:   students.photoUrl,
      batchId:        studentEnrollments.batchId,
      batchName:      batches.name,
      batchCode:      batches.code,
      status:         studentEnrollments.status,
      enrollmentDate: studentEnrollments.enrollmentDate,
    })
    .from(studentEnrollments)
    .innerJoin(students, eq(studentEnrollments.studentId, students.id))
    .leftJoin(batches,   eq(studentEnrollments.batchId,   batches.id))
    .where(and(
      eq(studentEnrollments.tenantId,  tenantId),
      eq(studentEnrollments.programId, semOff.programId),
      eq(studentEnrollments.sessionId, semOff.sessionId),
      isNull(studentEnrollments.deletedAt),
    ))
    .orderBy(students.name)

  return { data: rows, programId: semOff.programId, sessionId: semOff.sessionId }
}

export async function bulkAssignBatch(
  tenantId: string,
  performedBy: string,
  enrollmentIds: string[],
  batchId: string | null,
) {
  if (!enrollmentIds.length) return { updated: 0 }

  return db.transaction(async (tx) => {
    const updated = await tx
      .update(studentEnrollments)
      .set({ batchId, updatedBy: performedBy, updatedAt: new Date() })
      .where(and(
        inArray(studentEnrollments.id, enrollmentIds),
        eq(studentEnrollments.tenantId, tenantId),
        isNull(studentEnrollments.deletedAt),
      ))
      .returning({ id: studentEnrollments.id })

    if (updated.length) {
      await tx.insert(enrollmentAuditLogs).values(
        updated.map((e) => ({
          tenantId, enrollmentId: e.id, action: 'UPDATE' as const, performedBy,
          snapshot: { batchId } as any,
        }))
      )
    }

    return { updated: updated.length }
  })
}
