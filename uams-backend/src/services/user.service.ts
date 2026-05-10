import { eq, and, ilike, or, count } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { db } from '../lib/db'
import { users } from '../db/schema/users'
import type { CreateUserInput, UpdateStatusInput, ResetPasswordInput } from '../lib/validators/user.validator'

export async function createUser(tenantId: string, input: CreateUserInput) {
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.tenantId, tenantId), eq(users.email, input.email)))
    .limit(1)

  if (existing) throw new Error('A user with this email already exists.')

  const passwordHash = input.authProvider === 'email' && input.password
    ? await bcrypt.hash(input.password, 12)
    : null

  const [user] = await db.insert(users).values({
    tenantId,
    email:        input.email,
    firstName:    input.firstName,
    lastName:     input.lastName,
    role:         input.role,
    authProvider: input.authProvider,
    passwordHash,
    status:       'active',
    isActive:     true,
  }).returning()

  const { passwordHash: _, ...safeUser } = user
  return safeUser
}

export async function listUsers(tenantId: string, page = 1, limit = 20, search?: string) {
  const offset = (page - 1) * limit

  const conditions = [eq(users.tenantId, tenantId)]
  if (search) {
    conditions.push(
      or(
        ilike(users.firstName, `%${search}%`),
        ilike(users.lastName,  `%${search}%`),
        ilike(users.email,     `%${search}%`),
      )!
    )
  }

  const where = and(...conditions)

  const [rows, [{ total }]] = await Promise.all([
    db.select({
      id:           users.id,
      firstName:    users.firstName,
      lastName:     users.lastName,
      email:        users.email,
      role:         users.role,
      status:       users.status,
      authProvider: users.authProvider,
      createdAt:    users.createdAt,
    }).from(users).where(where).limit(limit).offset(offset),
    db.select({ total: count() }).from(users).where(where),
  ])

  return { data: rows, total: Number(total), page, limit }
}

export async function getUserById(tenantId: string, userId: string) {
  const [user] = await db
    .select({
      id:           users.id,
      firstName:    users.firstName,
      lastName:     users.lastName,
      email:        users.email,
      role:         users.role,
      status:       users.status,
      authProvider: users.authProvider,
      createdAt:    users.createdAt,
    })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.tenantId, tenantId)))
    .limit(1)

  if (!user) throw new Error('User not found.')
  return user
}

export async function updateUserStatus(tenantId: string, userId: string, input: UpdateStatusInput) {
  const [user] = await db
    .update(users)
    .set({
      status:    input.status,
      isActive:  input.status === 'active',
      updatedAt: new Date(),
    })
    .where(and(eq(users.id, userId), eq(users.tenantId, tenantId)))
    .returning({ id: users.id, status: users.status })

  if (!user) throw new Error('User not found.')
  return user
}

export async function resetUserPassword(tenantId: string, userId: string, input: ResetPasswordInput) {
  const passwordHash = await bcrypt.hash(input.newPassword, 12)

  const [user] = await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(and(eq(users.id, userId), eq(users.tenantId, tenantId), eq(users.authProvider, 'email')))
    .returning({ id: users.id, email: users.email })

  if (!user) throw new Error('User not found or uses Google auth.')
  return { message: 'Password reset successfully.' }
}
