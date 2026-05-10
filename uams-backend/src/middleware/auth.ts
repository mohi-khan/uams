import { createMiddleware } from 'hono/factory'
import jwt from 'jsonwebtoken'
import type { JwtPayload } from '../types'

export const authMiddleware = createMiddleware<{
  Variables: { user: JwtPayload }
}>(async (c, next) => {
  const authHeader = c.req.header('Authorization')

  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const token = authHeader.slice(7)

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload
    c.set('user', payload)
    await next()
  } catch {
    return c.json({ error: 'Invalid or expired token.' }, 401)
  }
})
