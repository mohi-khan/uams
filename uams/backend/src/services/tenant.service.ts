import { eq } from 'drizzle-orm'
import { randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'
import { db } from '../lib/db'
import { redis } from '../lib/redis'
import { tenants } from '../db/schema/tenants'
import { users } from '../db/schema/users'
import { sendVerificationEmail } from '../lib/email'
import type { RegisterTenantInput } from '../lib/validators/tenant.validator'

const VERIFICATION_TTL = 60 * 60 * 24 // 24 hours in seconds

export async function registerTenant(input: RegisterTenantInput) {
  // Check duplicate university email
  const existing = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.email, input.universityEmail))
    .limit(1)

  if (existing.length > 0) {
    throw new Error('A university with this email is already registered.')
  }

  // Create tenant (inactive until verified)
  const [tenant] = await db
    .insert(tenants)
    .values({
      name:       input.universityName,
      email:      input.universityEmail,
      phone:      input.phone,
      address:    input.address,
      city:       input.city,
      country:    input.country,
      tier:       input.tier,
      isVerified: false,
      isActive:   false,
    })
    .returning()

  // Create first admin user (inactive until verified)
  const passwordHash = await bcrypt.hash(input.password, 12)

  await db.insert(users).values({
    tenantId:     tenant.id,
    email:        input.adminEmail,
    passwordHash,
    firstName:    input.firstName,
    lastName:     input.lastName,
    role:         'admin',
    authProvider: 'email',
    isActive:     false,
  })

  // Generate verification token and store in Redis
  const token = randomBytes(32).toString('hex')
  await redis.set(`verify:tenant:${token}`, tenant.id, 'EX', VERIFICATION_TTL)

  // Send verification email
  await sendVerificationEmail(input.universityEmail, input.universityName, token)

  return { message: 'Registration successful. Please check your email to verify your account.' }
}

export async function verifyTenant(token: string) {
  const tenantId = await redis.get(`verify:tenant:${token}`)

  if (!tenantId) {
    throw new Error('Verification link is invalid or has expired.')
  }

  // Activate tenant and its admin user
  await db
    .update(tenants)
    .set({ isVerified: true, isActive: true, updatedAt: new Date() })
    .where(eq(tenants.id, tenantId))

  await db
    .update(users)
    .set({ isActive: true, updatedAt: new Date() })
    .where(eq(users.tenantId, tenantId))

  // Invalidate token
  await redis.del(`verify:tenant:${token}`)

  return { message: 'Email verified successfully. You can now log in.' }
}
