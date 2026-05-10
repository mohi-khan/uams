'use client'

import Link from 'next/link'
import {
  Users, School, Layers, GraduationCap, ClipboardList, BarChart2,
  ArrowRight, ShieldCheck,
} from 'lucide-react'

interface PanelCard {
  title:       string
  description: string
  href:        string
  icon:        React.ElementType
  color:       string
}

const PANELS: PanelCard[] = [
  {
    title:       'User Management',
    description: 'Create, activate, suspend, and reset passwords for all users in your institution.',
    href:        '/dashboard/users',
    icon:        Users,
    color:       'bg-indigo-50 text-indigo-600 border-indigo-100',
  },
  {
    title:       'Faculties',
    description: 'Manage top-level academic faculties. Every department belongs to a faculty.',
    href:        '/dashboard/faculties',
    icon:        School,
    color:       'bg-blue-50 text-blue-600 border-blue-100',
  },
  {
    title:       'Departments',
    description: 'Manage departments under each faculty. Full audit trail on every change.',
    href:        '/dashboard/departments',
    icon:        Layers,
    color:       'bg-orange-50 text-orange-600 border-orange-100',
  },
  {
    title:       'Courses & Sections',
    description: 'Create courses, assign teachers, and open sections for student enrollment.',
    href:        '/dashboard/courses',
    icon:        GraduationCap,
    color:       'bg-green-50 text-green-600 border-green-100',
  },
  {
    title:       'Enrollment',
    description: 'Enroll students into course sections and manage enrollment records.',
    href:        '/dashboard/enrollment',
    icon:        ClipboardList,
    color:       'bg-purple-50 text-purple-600 border-purple-100',
  },
  {
    title:       'Reports',
    description: 'View academic performance reports, attendance summaries, and more.',
    href:        '/dashboard/reports',
    icon:        BarChart2,
    color:       'bg-teal-50 text-teal-600 border-teal-100',
  },
]

export default function AdminControlPanelPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-6">

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shrink-0">
          <ShieldCheck size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Admin Control Panel</h1>
          <p className="text-sm text-gray-500">Manage all aspects of your institution from here.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {PANELS.map((panel) => {
          const Icon = panel.icon
          return (
            <Link
              key={panel.href}
              href={panel.href}
              className="group bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md hover:border-gray-200 transition-all flex flex-col gap-3"
            >
              <div className={`w-11 h-11 rounded-xl border flex items-center justify-center ${panel.color}`}>
                <Icon size={20} />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 text-sm mb-1">{panel.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{panel.description}</p>
              </div>
              <div className="flex items-center gap-1 text-xs font-medium text-indigo-600 group-hover:gap-2 transition-all">
                Manage <ArrowRight size={13} />
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
