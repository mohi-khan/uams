import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { registerTenantSchema } from '../lib/validators/tenant.validator'
import { registerTenant, verifyTenant } from '../services/tenant.service'

const tenantRoute = new Hono()

tenantRoute.post('/register', zValidator('json', registerTenantSchema), async (c) => {
  try {
    const input = c.req.valid('json')
    const result = await registerTenant(input)
    return c.json(result, 201)
  } catch (err: any) {
    return c.json({ error: err.message }, 400)
  }
})

tenantRoute.get('/verify', async (c) => {
  try {
    const token = c.req.query('token')
    if (!token) return c.json({ error: 'Token is required.' }, 400)

    const result = await verifyTenant(token)
    return c.json(result, 200)
  } catch (err: any) {
    return c.json({ error: err.message }, 400)
  }
})

export default tenantRoute
