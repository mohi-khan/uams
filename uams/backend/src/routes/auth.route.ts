import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { loginSchema, refreshSchema, activateInvitationSchema, googleIdTokenSchema } from '../lib/validators/auth.validator'
import { login, refreshAccessToken, logout, activateInvitation, googleLogin, devLogin } from '../services/auth.service'
import { authMiddleware } from '../middleware/auth'

const authRoute = new Hono()

authRoute.post('/login', zValidator('json', loginSchema), async (c) => {
  try {
    const input = c.req.valid('json')
    const result = await login(input)
    return c.json(result, 200)
  } catch (err: any) {
    return c.json({ error: err.message }, 401)
  }
})

authRoute.post('/refresh', zValidator('json', refreshSchema), async (c) => {
  try {
    const { refreshToken } = c.req.valid('json')
    const tokens = await refreshAccessToken(refreshToken)
    return c.json(tokens, 200)
  } catch (err: any) {
    return c.json({ error: err.message }, 401)
  }
})

authRoute.post('/logout', authMiddleware, async (c) => {
  const user = c.get('user')
  await logout(user.sub)
  return c.json({ message: 'Logged out successfully.' }, 200)
})

authRoute.post('/google', zValidator('json', googleIdTokenSchema), async (c) => {
  try {
    return c.json(await googleLogin(c.req.valid('json')), 200)
  } catch (err: any) {
    return c.json({ error: err.message }, 401)
  }
})

authRoute.post('/dev-login', async (c) => {
  try {
    const { studentId } = await c.req.json()
    return c.json(await devLogin(studentId), 200)
  } catch (err: any) {
    return c.json({ error: err.message }, err.message.includes('production') ? 403 : 404)
  }
})

authRoute.post('/activate-invitation', zValidator('json', activateInvitationSchema), async (c) => {
  try {
    return c.json(await activateInvitation(c.req.valid('json')))
  } catch (err: any) {
    return c.json({ error: err.message }, 400)
  }
})

export default authRoute
