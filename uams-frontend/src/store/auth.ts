import { atom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import type { User } from '@/types'

export const accessTokenAtom  = atomWithStorage<string | null>('access_token', null)
export const refreshTokenAtom = atomWithStorage<string | null>('refresh_token', null)
export const currentUserAtom  = atomWithStorage<User | null>('current_user', null)

// Derived — true when a valid token is present
export const isAuthenticatedAtom = atom((get) => !!get(accessTokenAtom))
