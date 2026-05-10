'use client'

import { useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import { useSetAtom, useAtomValue } from 'jotai'
import { LogOut, Bell } from 'lucide-react'
import { currentUserAtom, accessTokenAtom, refreshTokenAtom } from '@/store/auth'
import { logoutApi } from '@/lib/api/auth'

interface HeaderProps {
  title: string
}

export function Header({ title }: HeaderProps) {
  const router         = useRouter()
  const user           = useAtomValue(currentUserAtom)
  const setAccessToken  = useSetAtom(accessTokenAtom)
  const setRefreshToken = useSetAtom(refreshTokenAtom)
  const setCurrentUser  = useSetAtom(currentUserAtom)

  const { mutate: doLogout, isPending } = useMutation({
    mutationFn: logoutApi,
    onSettled: () => {
      setAccessToken(null)
      setRefreshToken(null)
      setCurrentUser(null)
      router.push('/login')
    },
  })

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0">
      <h1 className="text-lg font-semibold text-gray-800">{title}</h1>

      <div className="flex items-center gap-3">
        {/* Notifications placeholder */}
        <button className="relative p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
          <Bell size={18} />
        </button>

        {/* User chip */}
        {user && (
          <div className="flex items-center gap-2 pl-3 border-l border-gray-200">
            <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 text-sm font-semibold">
              {user.firstName[0]}{user.lastName[0]}
            </div>
            <span className="text-sm text-gray-700 font-medium">
              {user.firstName} {user.lastName}
            </span>
          </div>
        )}

        {/* Logout */}
        <button
          onClick={() => doLogout()}
          disabled={isPending}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-600 transition-colors px-2 py-1.5 rounded-lg hover:bg-red-50"
        >
          <LogOut size={15} />
          {isPending ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </header>
  )
}
