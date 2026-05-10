import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { eq } from 'drizzle-orm'
import { authMiddleware } from '../middleware/auth'
import { rbac } from '../middleware/rbac'
import { db } from '../lib/db'
import { users } from '../db/schema/users'
import { students } from '../db/schema/enrollment'
import {
  createEnrollmentSchema, updateEnrollmentSchema,
  addSemesterSchema, updateSemesterSchema,
  updateInstallmentSchema,
  recordPaymentSchema,
  bulkAssignBatchSchema,
} from '../lib/validators/enrollment-txn.validator'
import {
  listEnrollments, createEnrollment, getEnrollmentById,
  updateEnrollment, deleteEnrollment, getEnrollmentAuditLogs,
  listSemesters, addSemester, updateSemester,
  listInstallments, updateInstallment,
  listPayments, recordPayment,
  getEnrollmentsBySemesterOffering, bulkAssignBatch,
} from '../services/student-enrollment.service'
import type { JwtPayload } from '../types'

type Variables = { user: JwtPayload }
const enrollmentRoute = new Hono<{ Variables: Variables }>()

enrollmentRoute.use('*', authMiddleware)

const readRbac  = rbac('admin', 'super_admin', 'academic_coordinator', 'dean')
const writeRbac = rbac('admin', 'super_admin', 'academic_coordinator')

// ── Enrollments ───────────────────────────────────────────────────────────────

enrollmentRoute.get('/', readRbac, async (c) => {
  const { tenantId } = c.get('user')
  const page      = Number(c.req.query('page')  ?? 1)
  const limit     = Number(c.req.query('limit') ?? 20)
  const programId = c.req.query('programId')
  const status    = c.req.query('status')
  const search    = c.req.query('search')
  return c.json(await listEnrollments(tenantId, page, limit, { search, programId, status }))
})

enrollmentRoute.get('/me', rbac('student'), async (c) => {
  const { tenantId, sub } = c.get('user')
  try {
    const [user] = await db.select({ email: users.email }).from(users).where(eq(users.id, sub)).limit(1)
    if (!user) return c.json({ error: 'User not found.' }, 404)
    const [student] = await db.select({ id: students.id }).from(students)
      .where(eq(students.gmailAccount, user.email)).limit(1)
    if (!student) return c.json({ error: 'Student record not found.' }, 404)
    return c.json(await listEnrollments(tenantId, 1, 50, { studentId: student.id }))
  } catch (err: any) {
    return c.json({ error: err.message }, 404)
  }
})

enrollmentRoute.get('/by-semester-offering/:semesterOfferingId', readRbac, async (c) => {
  const { tenantId } = c.get('user')
  try {
    return c.json(await getEnrollmentsBySemesterOffering(tenantId, c.req.param('semesterOfferingId')))
  } catch (err: any) {
    return c.json({ error: err.message }, 404)
  }
})

enrollmentRoute.put('/bulk-assign-batch', writeRbac, zValidator('json', bulkAssignBatchSchema), async (c) => {
  const { tenantId, sub } = c.get('user')
  try {
    return c.json(await bulkAssignBatch(tenantId, sub, c.req.valid('json').enrollmentIds, c.req.valid('json').batchId))
  } catch (err: any) {
    return c.json({ error: err.message }, 400)
  }
})

enrollmentRoute.get('/:id/audit', writeRbac, async (c) => {
  const { tenantId } = c.get('user')
  try {
    return c.json({ data: await getEnrollmentAuditLogs(tenantId, c.req.param('id')) })
  } catch (err: any) {
    return c.json({ error: err.message }, 404)
  }
})

enrollmentRoute.get('/:id', readRbac, async (c) => {
  const { tenantId } = c.get('user')
  try {
    return c.json(await getEnrollmentById(tenantId, c.req.param('id')))
  } catch (err: any) {
    return c.json({ error: err.message }, 404)
  }
})

enrollmentRoute.post('/', writeRbac, zValidator('json', createEnrollmentSchema), async (c) => {
  const { tenantId, sub } = c.get('user')
  try {
    return c.json(await createEnrollment(tenantId, sub, c.req.valid('json')), 201)
  } catch (err: any) {
    return c.json({ error: err.message }, 400)
  }
})

enrollmentRoute.put('/:id', writeRbac, zValidator('json', updateEnrollmentSchema), async (c) => {
  const { tenantId, sub } = c.get('user')
  try {
    return c.json(await updateEnrollment(tenantId, sub, c.req.param('id'), c.req.valid('json')))
  } catch (err: any) {
    return c.json({ error: err.message }, err.message.includes('not found') ? 404 : 400)
  }
})

enrollmentRoute.delete('/:id', writeRbac, async (c) => {
  const { tenantId, sub } = c.get('user')
  try {
    await deleteEnrollment(tenantId, sub, c.req.param('id'))
    return c.json({ message: 'Enrollment removed.' })
  } catch (err: any) {
    return c.json({ error: err.message }, 404)
  }
})

// ── Semesters ─────────────────────────────────────────────────────────────────

enrollmentRoute.get('/:id/semesters', readRbac, async (c) => {
  const { tenantId } = c.get('user')
  return c.json({ data: await listSemesters(tenantId, c.req.param('id')) })
})

enrollmentRoute.post('/:id/semesters', writeRbac, zValidator('json', addSemesterSchema), async (c) => {
  const { tenantId, sub } = c.get('user')
  try {
    return c.json(await addSemester(tenantId, sub, c.req.param('id'), c.req.valid('json')), 201)
  } catch (err: any) {
    return c.json({ error: err.message }, err.message.includes('not found') ? 404 : 400)
  }
})

enrollmentRoute.put('/:id/semesters/:semId', writeRbac, zValidator('json', updateSemesterSchema), async (c) => {
  const { tenantId, sub } = c.get('user')
  try {
    return c.json(await updateSemester(tenantId, sub, c.req.param('semId'), c.req.valid('json')))
  } catch (err: any) {
    return c.json({ error: err.message }, 404)
  }
})

// ── Installments ──────────────────────────────────────────────────────────────

enrollmentRoute.get('/:id/installments', readRbac, async (c) => {
  const { tenantId } = c.get('user')
  return c.json({ data: await listInstallments(tenantId, c.req.param('id')) })
})

enrollmentRoute.put('/:id/installments/:instId', writeRbac, zValidator('json', updateInstallmentSchema), async (c) => {
  const { tenantId, sub } = c.get('user')
  try {
    return c.json(await updateInstallment(tenantId, sub, c.req.param('instId'), c.req.valid('json')))
  } catch (err: any) {
    return c.json({ error: err.message }, 404)
  }
})

// ── Payments ──────────────────────────────────────────────────────────────────

enrollmentRoute.get('/:id/payments', readRbac, async (c) => {
  const { tenantId } = c.get('user')
  return c.json({ data: await listPayments(tenantId, c.req.param('id')) })
})

enrollmentRoute.post('/:id/payments', writeRbac, zValidator('json', recordPaymentSchema), async (c) => {
  const { tenantId, sub } = c.get('user')
  try {
    return c.json(await recordPayment(tenantId, sub, c.req.param('id'), c.req.valid('json')), 201)
  } catch (err: any) {
    return c.json({ error: err.message }, err.message.includes('not found') ? 404 : 400)
  }
})

export default enrollmentRoute
