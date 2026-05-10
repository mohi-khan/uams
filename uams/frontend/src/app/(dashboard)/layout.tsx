'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAtomValue } from 'jotai'
import { accessTokenAtom, currentUserAtom } from '@/store/auth'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { NAV_ITEMS } from '@/components/layout/nav-config'

function getPageTitle(pathname: string, role: string | undefined): string {
  if (!role) return 'Dashboard'
  const items = NAV_ITEMS[role as keyof typeof NAV_ITEMS] ?? []
  return items.find((i) => i.href === pathname)?.label ?? 'Dashboard'
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()
  const token    = useAtomValue(accessTokenAtom)
  const user     = useAtomValue(currentUserAtom)

  // Wait for client hydration before checking localStorage-backed token
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (mounted && !token) router.replace('/login')
  }, [mounted, token, router])

  // Show nothing until hydrated — prevents flash of redirect
  if (!mounted) return null
  if (!token)   return null

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title={getPageTitle(pathname, user?.role)} />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
