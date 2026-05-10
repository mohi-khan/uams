import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { eq } from 'drizzle-orm'
import { authMiddleware } from '../middleware/auth'
import { rbac } from '../middleware/rbac'
import { db } from '../lib/db'
import { users } from '../db/schema/users'
import {
  createStudentSchema, updateStudentSchema, photoUploadSchema, revealNidSchema,
} from '../lib/validators/enrollment.validator'
import {
  createStudent, listStudents, getStudentById, getStudentByGmail,
  updateStudent, deleteStudent, getStudentAuditLogs,
  getPhotoUploadSignedUrl, revealStudentNid,
} from '../services/student.service'
import type { JwtPayload } from '../types'

type Variables = { user: JwtPayload }
const studentRoute = new Hono<{ Variables: Variables }>()

studentRoute.use('*', authMiddleware)

const readRbac  = rbac('admin', 'super_admin', 'academic_coordinator', 'dean')
const writeRbac = rbac('admin', 'super_admin')

studentRoute.get('/photo-upload-url', writeRbac, zValidator('query', photoUploadSchema), async (c) => {
  const { tenantId } = c.get('user')
  try {
    return c.json(await getPhotoUploadSignedUrl(tenantId, c.req.valid('query')))
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

studentRoute.get('/', readRbac, async (c) => {
  const { tenantId } = c.get('user')
  const page   = Number(c.req.query('page')  ?? 1)
  const limit  = Number(c.req.query('limit') ?? 20)
  const search = c.req.query('search')
  return c.json(await listStudents(tenantId, page, limit, search))
})

studentRoute.post('/:id/reveal-nid', writeRbac, zValidator('json', revealNidSchema), async (c) => {
  const { tenantId, sub } = c.get('user')
  try {
    const nid = await revealStudentNid(tenantId, sub, c.req.param('id'), c.req.valid('json').password)
    return c.json({ nid })
  } catch (err: any) {
    const status = err.message.includes('not found') ? 404 : 401
    return c.json({ error: err.message }, status)
  }
})

studentRoute.get('/:id/audit', writeRbac, async (c) => {
  const { tenantId } = c.get('user')
  try {
    return c.json({ data: await getStudentAuditLogs(tenantId, c.req.param('id')) })
  } catch (err: any) {
    return c.json({ error: err.message }, 404)
  }
})

studentRoute.get('/me', rbac('student'), async (c) => {
  const { tenantId, sub } = c.get('user')
  try {
    const [user] = await db.select({ email: users.email }).from(users).where(eq(users.id, sub)).limit(1)
    if (!user) return c.json({ error: 'User not found.' }, 404)
    return c.json(await getStudentByGmail(tenantId, user.email))
  } catch (err: any) {
    return c.json({ error: err.message }, 404)
  }
})

studentRoute.get('/:id', readRbac, async (c) => {
  const { tenantId } = c.get('user')
  try {
    return c.json(await getStudentById(tenantId, c.req.param('id')))
  } catch (err: any) {
    return c.json({ error: err.message }, 404)
  }
})

studentRoute.post('/', writeRbac, zValidator('json', createStudentSchema), async (c) => {
  const { tenantId, sub } = c.get('user')
  try {
    return c.json(await createStudent(tenantId, sub, c.req.valid('json')), 201)
  } catch (err: any) {
    return c.json({ error: err.message }, 400)
  }
})

studentRoute.put('/:id', writeRbac, zValidator('json', updateStudentSchema), async (c) => {
  const { tenantId, sub } = c.get('user')
  try {
    return c.json(await updateStudent(tenantId, sub, c.req.param('id'), c.req.valid('json')))
  } catch (err: any) {
    return c.json({ error: err.message }, err.message.includes('not found') ? 404 : 400)
  }
})

studentRoute.delete('/:id', writeRbac, async (c) => {
  const { tenantId, sub } = c.get('user')
  try {
    return c.json(await deleteStudent(tenantId, sub, c.req.param('id')))
  } catch (err: any) {
    return c.json({ error: err.message }, 404)
  }
})

export default studentRoute
