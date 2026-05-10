import { eq, and, isNull } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { OAuth2Client } from 'google-auth-library'
import { db } from '../lib/db'
import { redis } from '../lib/redis'
import { users } from '../db/schema/users'
import { tenants } from '../db/schema/tenants'
import { teachers } from '../db/schema/academic'
import { students } from '../db/schema/enrollment'
import type { JwtPayload } from '../types'
import type { LoginInput, ActivateInvitationInput, GoogleIdTokenInput } from '../lib/validators/auth.validator'

const oauthClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)

const ACCESS_TTL  = process.env.JWT_EXPIRES_IN          ?? '15m'
const REFRESH_TTL = process.env.REFRESH_TOKEN_EXPIRES_IN ?? '7d'
const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60 // 7 days

function generateTokens(payload: JwtPayload) {
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET!, {
    expiresIn: ACCESS_TTL as jwt.SignOptions['expiresIn'],
  })
  const refreshToken = jwt.sign({ sub: payload.sub }, process.env.REFRESH_TOKEN_SECRET!, {
    expiresIn: REFRESH_TTL as jwt.SignOptions['expiresIn'],
  })
  return { accessToken, refreshToken }
}

export async function login(input: LoginInput) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, input.email))
    .limit(1)

  if (!user)                    throw new Error('Invalid email or password.')
  if (!user.isActive)           throw new Error('Account is not active. Please verify your email.')
  if (user.authProvider !== 'email') throw new Error('Please sign in with Google.')
  if (!user.passwordHash)       throw new Error('Invalid email or password.')

  const valid = await bcrypt.compare(input.password, user.passwordHash)
  if (!valid) throw new Error('Invalid email or password.')

  // Verify tenant is active (super_admin has no tenant)
  if (user.tenantId) {
    const [tenant] = await db
      .select({ isActive: tenants.isActive })
      .from(tenants)
      .where(and(eq(tenants.id, user.tenantId), eq(tenants.isActive, true)))
      .limit(1)

    if (!tenant) throw new Error('Your institution account is suspended or not verified.')
  }

  const payload: JwtPayload = {
    sub:      user.id,
    tenantId: user.tenantId ?? '',
    role:     user.role,
  }

  const { accessToken, refreshToken } = generateTokens(payload)

  // Store refresh token in Redis
  await redis.set(`refresh:${user.id}`, refreshToken, 'EX', REFRESH_TTL_SECONDS)

  return {
    accessToken,
    refreshToken,
    user: {
      id:        user.id,
      email:     user.email,
      firstName: user.firstName,
      lastName:  user.lastName,
      role:      user.role,
      tenantId:  user.tenantId,
    },
  }
}

export async function refreshAccessToken(refreshToken: string) {
  let decoded: jwt.JwtPayload

  try {
    decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET!) as jwt.JwtPayload
  } catch {
    throw new Error('Invalid or expired refresh token.')
  }

  const userId = decoded.sub as string
  const stored = await redis.get(`refresh:${userId}`)

  if (!stored || stored !== refreshToken) {
    throw new Error('Refresh token has been revoked.')
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!user || !user.isActive) throw new Error('User not found or inactive.')

  const payload: JwtPayload = {
    sub:      user.id,
    tenantId: user.tenantId ?? '',
    role:     user.role,
  }

  const tokens = generateTokens(payload)
  await redis.set(`refresh:${userId}`, tokens.refreshToken, 'EX', REFRESH_TTL_SECONDS)

  return tokens
}

export async function logout(userId: string) {
  await redis.del(`refresh:${userId}`)
}

export async function googleLogin(input: GoogleIdTokenInput) {
  let email: string
  let googleId: string

  try {
    const ticket = await oauthClient.verifyIdToken({
      idToken:  input.idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    })
    const p = ticket.getPayload()
    if (!p?.email) throw new Error()
    email    = p.email.toLowerCase()
    googleId = p.sub
  } catch {
    throw new Error('Invalid Google token. Please try again.')
  }

  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.email, email), eq(users.authProvider, 'google')))
    .limit(1)

  if (!user) throw new Error('No account found for this Google address. Contact your institution.')
  if (!user.isActive) throw new Error('Your account is not active.')

  if (!user.googleId) {
    await db.update(users).set({ googleId, updatedAt: new Date() }).where(eq(users.id, user.id))
  }

  if (user.tenantId) {
    const [tenant] = await db
      .select({ isActive: tenants.isActive })
      .from(tenants)
      .where(and(eq(tenants.id, user.tenantId), eq(tenants.isActive, true)))
      .limit(1)
    if (!tenant) throw new Error('Your institution account is suspended.')
  }

  const payload: JwtPayload = { sub: user.id, tenantId: user.tenantId ?? '', role: user.role }
  const { accessToken, refreshToken } = generateTokens(payload)
  await redis.set(`refresh:${user.id}`, refreshToken, 'EX', REFRESH_TTL_SECONDS)

  return {
    accessToken,
    refreshToken,
    user: {
      id:        user.id,
      email:     user.email,
      firstName: user.firstName,
      lastName:  user.lastName,
      role:      user.role,
      tenantId:  user.tenantId,
    },
  }
}

export async function activateInvitation(input: ActivateInvitationInput) {
  const teacherId = await redis.get(`invite:teacher:${input.token}`)
  if (!teacherId) throw new Error('Invitation link is invalid or has expired.')

  const [teacher] = await db
    .select({ id: teachers.id, userId: teachers.userId, tenantId: teachers.tenantId })
    .from(teachers)
    .where(eq(teachers.id, teacherId))
    .limit(1)
  if (!teacher) throw new Error('Teacher record not found.')

  const [user] = await db.select().from(users).where(eq(users.id, teacher.userId)).limit(1)
  if (!user) throw new Error('User account not found.')
  if (user.isActive) throw new Error('Account is already active.')

  const passwordHash = await bcrypt.hash(input.password, 12)

  await db.update(users)
    .set({ passwordHash, isActive: true, updatedAt: new Date() })
    .where(eq(users.id, teacher.userId))

  await db.update(teachers)
    .set({ isActive: true, updatedAt: new Date() })
    .where(eq(teachers.id, teacher.id))

  await redis.del(`invite:teacher:${input.token}`)

  return { message: 'Account activated successfully. You can now log in.' }
}

export async function devLogin(studentId: string) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Not available in production.')
  }

  const [student] = await db
    .select({ id: students.id, tenantId: students.tenantId, gmailAccount: students.gmailAccount })
    .from(students)
    .where(and(eq(students.id, studentId), isNull(students.deletedAt)))
    .limit(1)

  if (!student || !student.gmailAccount) throw new Error('Test student not found.')

  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.email, student.gmailAccount), eq(users.tenantId, student.tenantId!)))
    .limit(1)

  if (!user) throw new Error('User account not found for test student.')

  const payload: JwtPayload = { sub: user.id, tenantId: user.tenantId ?? '', role: user.role }
  const { accessToken, refreshToken } = generateTokens(payload)
  await redis.set(`refresh:${user.id}`, refreshToken, 'EX', REFRESH_TTL_SECONDS)

  return {
    accessToken,
    refreshToken,
    user: {
      id:        user.id,
      email:     user.email,
      firstName: user.firstName,
      lastName:  user.lastName,
      role:      user.role,
      tenantId:  user.tenantId,
    },
  }
}
