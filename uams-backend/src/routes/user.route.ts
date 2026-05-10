import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { authMiddleware } from '../middleware/auth'
import { rbac } from '../middleware/rbac'
import {
  createUserSchema,
  updateStatusSchema,
  resetPasswordSchema,
} from '../lib/validators/user.validator'
import {
  createUser,
  listUsers,
  getUserById,
  updateUserStatus,
  resetUserPassword,
} from '../services/user.service'
import type { JwtPayload } from '../types'

type Variables = { user: JwtPayload }

const userRoute = new Hono<{ Variables: Variables }>()

userRoute.use('*', authMiddleware, rbac('admin', 'super_admin'))

// List users
userRoute.get('/', async (c) => {
  const { tenantId } = c.get('user')
  const page   = Number(c.req.query('page')   ?? 1)
  const limit  = Number(c.req.query('limit')  ?? 20)
  const search = c.req.query('search')

  const result = await listUsers(tenantId, page, limit, search)
  return c.json(result)
})

// Get single user
userRoute.get('/:id', async (c) => {
  const { tenantId } = c.get('user')
  try {
    const user = await getUserById(tenantId, c.req.param('id'))
    return c.json(user)
  } catch (err: any) {
    return c.json({ error: err.message }, 404)
  }
})

// Create user
userRoute.post('/', zValidator('json', createUserSchema), async (c) => {
  const { tenantId } = c.get('user')
  try {
    const input = c.req.valid('json')
    const user  = await createUser(tenantId, input)
    return c.json(user, 201)
  } catch (err: any) {
    return c.json({ error: err.message }, 400)
  }
})

// Update status (activate / deactivate / suspend)
userRoute.patch('/:id/status', zValidator('json', updateStatusSchema), async (c) => {
  const { tenantId } = c.get('user')
  try {
    const result = await updateUserStatus(tenantId, c.req.param('id'), c.req.valid('json'))
    return c.json(result)
  } catch (err: any) {
    return c.json({ error: err.message }, 404)
  }
})

// Reset password
userRoute.patch('/:id/password', zValidator('json', resetPasswordSchema), async (c) => {
  const { tenantId } = c.get('user')
  try {
    const result = await resetUserPassword(tenantId, c.req.param('id'), c.req.valid('json'))
    return c.json(result)
  } catch (err: any) {
    return c.json({ error: err.message }, 400)
  }
})

export default userRoute
