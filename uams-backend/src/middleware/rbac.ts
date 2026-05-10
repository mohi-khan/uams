import { createMiddleware } from 'hono/factory'
import type { Role, JwtPayload } from '../types'

export const rbac = (...allowed: Role[]) =>
  createMiddleware<{ Variables: { user: JwtPayload } }>(async (c, next) => {
    const user = c.get('user')

    if (!allowed.includes(user.role)) {
      return c.json({ error: 'Forbidden: insufficient permissions.' }, 403)
    }

    await next()
  })
