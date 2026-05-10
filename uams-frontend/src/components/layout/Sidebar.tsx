'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAtomValue } from 'jotai'
import { currentUserAtom } from '@/store/auth'
import { NAV_ITEMS } from './nav-config'

const ROLE_LABELS: Record<string, string> = {
  student:              'Student',
  teacher:              'Teacher',
  admin:                'Admin',
  dean:                 'Dean',
  academic_coordinator: 'Academic Coordinator',
  super_admin:          'Super Admin',
}

export function Sidebar() {
  const pathname  = usePathname()
  const user      = useAtomValue(currentUserAtom)
  const navItems  = user ? NAV_ITEMS[user.role] : []

  return (
    <aside className="w-64 min-h-screen bg-gray-900 flex flex-col">

      {/* Logo */}
      <div className="flex items-center gap-2.5 px-6 py-5 border-b border-gray-800">
        <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center shrink-0">
          <span className="text-white font-bold text-sm">U</span>
        </div>
        <div>
          <p className="text-white font-bold text-sm leading-none">UAMS</p>
          <p className="text-gray-400 text-xs mt-0.5">{user ? ROLE_LABELS[user.role] : ''}</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const active = pathname === item.href
          const Icon   = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <Icon size={17} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* User info */}
      {user && (
        <div className="px-4 py-4 border-t border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0">
              {user.firstName[0]}{user.lastName[0]}
            </div>
            <div className="overflow-hidden">
              <p className="text-white text-sm font-medium truncate">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-gray-400 text-xs truncate">{user.email}</p>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
