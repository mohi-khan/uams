'use client'

import { useAtomValue } from 'jotai'
import { useQuery } from '@tanstack/react-query'
import { currentUserAtom } from '@/store/auth'
import {
  ClipboardList, BookOpen, BarChart2,
  PlusSquare, CheckSquare, Upload, Users,
  GraduationCap, Settings, TrendingUp, BadgeCheck,
  Building2, ShieldCheck, CalendarCheck,
  Phone, MapPin, Mail, CreditCard, User,
} from 'lucide-react'
import type { Role } from '@/types'
import { getStudentMeApi } from '@/lib/api/students'
import { getMyEnrollmentsApi } from '@/lib/api/enrollments'

// ── Generic role overview ──────────────────────────────────────────────────────

interface StatCard {
  label: string
  value: string
  icon:  React.ElementType
  color: string
}

const ROLE_STATS: Record<Exclude<Role, 'student'>, StatCard[]> = {
  teacher: [
    { label: 'Active Assignments',  value: '—', icon: PlusSquare,  color: 'bg-blue-50 text-blue-600'    },
    { label: 'Pending Submissions', value: '—', icon: CheckSquare, color: 'bg-yellow-50 text-yellow-600' },
    { label: 'Quizzes Created',     value: '—', icon: BookOpen,    color: 'bg-purple-50 text-purple-600' },
    { label: 'Materials Uploaded',  value: '—', icon: Upload,      color: 'bg-green-50 text-green-600'  },
  ],
  admin: [
    { label: 'Total Courses',   value: '—', icon: GraduationCap, color: 'bg-blue-50 text-blue-600'   },
    { label: 'Total Students',  value: '—', icon: Users,         color: 'bg-green-50 text-green-600'  },
    { label: 'Total Teachers',  value: '—', icon: Users,         color: 'bg-purple-50 text-purple-600' },
    { label: 'Active Sections', value: '—', icon: Settings,      color: 'bg-orange-50 text-orange-600' },
  ],
  dean: [
    { label: 'Total Students',    value: '—', icon: Users,      color: 'bg-blue-50 text-blue-600'    },
    { label: 'Average GPA',       value: '—', icon: TrendingUp, color: 'bg-green-50 text-green-600'  },
    { label: 'Pending Approvals', value: '—', icon: BadgeCheck, color: 'bg-yellow-50 text-yellow-600' },
    { label: 'Active Courses',    value: '—', icon: BookOpen,   color: 'bg-purple-50 text-purple-600' },
  ],
  academic_coordinator: [
    { label: 'Active Courses',    value: '—', icon: GraduationCap, color: 'bg-blue-50 text-blue-600'    },
    { label: 'Enrolled Students', value: '—', icon: Users,         color: 'bg-green-50 text-green-600'  },
    { label: 'Open Sections',     value: '—', icon: CalendarCheck, color: 'bg-orange-50 text-orange-600' },
    { label: 'Pending Reports',   value: '—', icon: BarChart2,     color: 'bg-purple-50 text-purple-600' },
  ],
  super_admin: [
    { label: 'Universities',   value: '—',  icon: Building2,  color: 'bg-blue-50 text-blue-600'     },
    { label: 'Total Users',    value: '—',  icon: Users,      color: 'bg-green-50 text-green-600'   },
    { label: 'Active Tenants', value: '—',  icon: ShieldCheck, color: 'bg-indigo-50 text-indigo-600' },
    { label: 'System Health',  value: 'OK', icon: Settings,   color: 'bg-emerald-50 text-emerald-600' },
  ],
}

const ROLE_LABELS: Record<Role, string> = {
  student:              'Student',
  teacher:              'Teacher',
  admin:                'Administrator',
  dean:                 'Dean',
  academic_coordinator: 'Academic Coordinator',
  super_admin:          'Super Admin',
}

// ── Student control panel ──────────────────────────────────────────────────────

function StudentDashboard() {
  const { data: profile, isLoading: loadingProfile } = useQuery({
    queryKey: ['student-me'],
    queryFn:  getStudentMeApi,
  })
  const { data: enrollments, isLoading: loadingEnroll } = useQuery({
    queryKey: ['enrollments-me'],
    queryFn:  getMyEnrollmentsApi,
  })

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* Banner */}
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-500 rounded-2xl p-6 text-white">
        <p className="text-indigo-200 text-sm font-medium mb-1">Student</p>
        <h2 className="text-2xl font-bold">
          {profile ? `Welcome, ${profile.name}` : 'Welcome back!'}
        </h2>
        {profile && (
          <p className="text-indigo-200 text-sm mt-1">Student ID: {profile.studentCode}</p>
        )}
      </div>

      {/* Profile card */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <User size={16} className="text-indigo-500" /> My Profile
        </h3>

        {loadingProfile ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : profile ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="flex items-start gap-2 text-gray-600">
              <User size={14} className="mt-0.5 text-gray-400 shrink-0" />
              <div>
                <p className="text-xs text-gray-400">Full Name</p>
                <p className="font-medium text-gray-800">{profile.name}</p>
              </div>
            </div>
            <div className="flex items-start gap-2 text-gray-600">
              <CreditCard size={14} className="mt-0.5 text-gray-400 shrink-0" />
              <div>
                <p className="text-xs text-gray-400">Student Code</p>
                <p className="font-medium text-gray-800">{profile.studentCode}</p>
              </div>
            </div>
            <div className="flex items-start gap-2 text-gray-600">
              <Mail size={14} className="mt-0.5 text-gray-400 shrink-0" />
              <div>
                <p className="text-xs text-gray-400">Contact Email</p>
                <p className="font-medium text-gray-800">{profile.email}</p>
              </div>
            </div>
            <div className="flex items-start gap-2 text-gray-600">
              <Mail size={14} className="mt-0.5 text-gray-400 shrink-0" />
              <div>
                <p className="text-xs text-gray-400">Google Account</p>
                <p className="font-medium text-gray-800">{profile.gmailAccount ?? '—'}</p>
              </div>
            </div>
            {profile.phone && (
              <div className="flex items-start gap-2 text-gray-600">
                <Phone size={14} className="mt-0.5 text-gray-400 shrink-0" />
                <div>
                  <p className="text-xs text-gray-400">Phone</p>
                  <p className="font-medium text-gray-800">{profile.phone}</p>
                </div>
              </div>
            )}
            {profile.address && (
              <div className="flex items-start gap-2 text-gray-600">
                <MapPin size={14} className="mt-0.5 text-gray-400 shrink-0" />
                <div>
                  <p className="text-xs text-gray-400">Address</p>
                  <p className="font-medium text-gray-800">{profile.address}</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-red-500">Could not load profile.</p>
        )}
      </div>

      {/* Enrollments */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <GraduationCap size={16} className="text-indigo-500" /> My Enrollments
        </h3>

        {loadingEnroll ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : !enrollments?.data?.length ? (
          <p className="text-sm text-gray-400 text-center py-6">No enrollments found.</p>
        ) : (
          <div className="space-y-3">
            {enrollments.data.map((e) => {
              const paid   = parseFloat(e.paidAmount)
              const total  = parseFloat(e.totalFee)
              const pct    = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0
              const statusColor: Record<string, string> = {
                active:    'bg-green-100 text-green-700',
                suspended: 'bg-yellow-100 text-yellow-700',
                completed: 'bg-blue-100 text-blue-700',
                dropped:   'bg-red-100 text-red-700',
              }
              return (
                <div key={e.id} className="border border-gray-100 rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-800">{e.programName}</p>
                      <p className="text-xs text-gray-400">{e.programCode}{e.sessionName ? ` · ${e.sessionName}` : ''}</p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColor[e.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {e.status}
                    </span>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Fee paid</span>
                      <span>৳{paid.toLocaleString()} / ৳{total.toLocaleString()} ({pct}%)</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Placeholder panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <ClipboardList size={16} className="text-indigo-500" /> Assignments
          </h3>
          <p className="text-sm text-gray-400 text-center py-6">No assignments yet.</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <BookOpen size={16} className="text-indigo-500" /> Upcoming
          </h3>
          <p className="text-sm text-gray-400 text-center py-6">Nothing scheduled yet.</p>
        </div>
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const user = useAtomValue(currentUserAtom)

  if (!user) return null
  if (user.role === 'student') return <StudentDashboard />

  const stats = ROLE_STATS[user.role as Exclude<Role, 'student'>]

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      {/* Welcome banner */}
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-500 rounded-2xl p-6 text-white">
        <p className="text-indigo-200 text-sm font-medium mb-1">{ROLE_LABELS[user.role]}</p>
        <h2 className="text-2xl font-bold">
          Welcome back, {user.firstName}!
        </h2>
        <p className="text-indigo-200 text-sm mt-1">
          Here's an overview of your academic activity.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <div key={stat.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${stat.color}`}>
                <Icon size={18} />
              </div>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-sm text-gray-500 mt-0.5">{stat.label}</p>
            </div>
          )
        })}
      </div>

      {/* Placeholder panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h3 className="font-semibold text-gray-800 mb-4">Recent Activity</h3>
          <p className="text-sm text-gray-400 text-center py-8">No recent activity yet.</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h3 className="font-semibold text-gray-800 mb-4">Upcoming</h3>
          <p className="text-sm text-gray-400 text-center py-8">Nothing scheduled yet.</p>
        </div>
      </div>
    </div>
  )
}
