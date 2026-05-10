'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { UserPlus, Search, MoreVertical, ShieldOff, ShieldCheck, Ban, KeyRound, X } from 'lucide-react'
import {
  listUsersApi, createUserApi, updateUserStatusApi, resetUserPasswordApi,
  type UserRow, type UserStatus, type CreateUserPayload,
} from '@/lib/api/users'

const STATUS_BADGE: Record<UserStatus, string> = {
  active:    'bg-green-100 text-green-700',
  inactive:  'bg-gray-100 text-gray-500',
  suspended: 'bg-red-100 text-red-600',
}

const ROLE_BADGE: Record<string, string> = {
  admin:                'bg-indigo-100 text-indigo-700',
  dean:                 'bg-purple-100 text-purple-700',
  academic_coordinator: 'bg-orange-100 text-orange-700',
  teacher:              'bg-blue-100 text-blue-700',
  student:              'bg-teal-100 text-teal-700',
}

const PASSWORD_RULES = [
  { label: 'At least 8 characters',     test: (v: string) => v.length >= 8 },
  { label: 'One uppercase letter',       test: (v: string) => /[A-Z]/.test(v) },
  { label: 'One lowercase letter',       test: (v: string) => /[a-z]/.test(v) },
  { label: 'One number',                 test: (v: string) => /[0-9]/.test(v) },
  { label: 'One special character',      test: (v: string) => /[^A-Za-z0-9]/.test(v) },
]

export default function UsersPage() {
  const qc = useQueryClient()

  const [search,  setSearch]  = useState('')
  const [page,    setPage]    = useState(1)
  const [menuId,  setMenuId]  = useState<string | null>(null)

  const [showCreate,    setShowCreate]    = useState(false)
  const [resetTarget,   setResetTarget]   = useState<UserRow | null>(null)
  const [newPassword,   setNewPassword]   = useState('')
  const [showPassRules, setShowPassRules] = useState(false)

  const [form, setForm] = useState<CreateUserPayload>({
    firstName: '', lastName: '', email: '',
    role: 'student', authProvider: 'email', password: '',
  })

  const { data, isLoading } = useQuery({
    queryKey: ['users', page, search],
    queryFn: () => listUsersApi(page, search || undefined),
  })

  const createMutation = useMutation({
    mutationFn: createUserApi,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      setShowCreate(false)
      setForm({ firstName: '', lastName: '', email: '', role: 'student', authProvider: 'email', password: '' })
    },
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: UserStatus }) => updateUserStatusApi(id, status),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); setMenuId(null) },
  })

  const resetMutation = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) => resetUserPasswordApi(id, password),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); setResetTarget(null); setNewPassword('') },
  })

  return (
    <div className="max-w-6xl mx-auto space-y-5">

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search users…"
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          <UserPlus size={15} /> Create User
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {['Name', 'Email', 'Role', 'Auth', 'Status', 'Joined', ''].map((h) => (
                <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading && (
              <tr><td colSpan={7} className="text-center py-10 text-gray-400 text-sm">Loading…</td></tr>
            )}
            {!isLoading && data?.data.length === 0 && (
              <tr><td colSpan={7} className="text-center py-10 text-gray-400 text-sm">No users found.</td></tr>
            )}
            {data?.data.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-medium text-gray-900">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-semibold shrink-0">
                      {user.firstName[0]}{user.lastName[0]}
                    </div>
                    {user.firstName} {user.lastName}
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-500">{user.email}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_BADGE[user.role]}`}>
                    {user.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 capitalize">{user.authProvider}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[user.status]}`}>
                    {user.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-400">
                  {new Date(user.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 relative">
                  <button onClick={() => setMenuId(menuId === user.id ? null : user.id)}
                    className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                    <MoreVertical size={15} />
                  </button>
                  {menuId === user.id && (
                    <div className="absolute right-8 top-2 z-20 bg-white border border-gray-200 rounded-xl shadow-lg py-1 w-48">
                      {user.status !== 'active' && (
                        <button onClick={() => statusMutation.mutate({ id: user.id, status: 'active' })}
                          className="flex items-center gap-2 w-full px-4 py-2 text-sm text-green-600 hover:bg-gray-50">
                          <ShieldCheck size={14} /> Activate
                        </button>
                      )}
                      {user.status === 'active' && (
                        <button onClick={() => statusMutation.mutate({ id: user.id, status: 'inactive' })}
                          className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
                          <ShieldOff size={14} /> Deactivate
                        </button>
                      )}
                      {user.status !== 'suspended' && (
                        <button onClick={() => statusMutation.mutate({ id: user.id, status: 'suspended' })}
                          className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-gray-50">
                          <Ban size={14} /> Suspend
                        </button>
                      )}
                      {user.authProvider === 'email' && (
                        <button onClick={() => { setResetTarget(user); setMenuId(null) }}
                          className="flex items-center gap-2 w-full px-4 py-2 text-sm text-indigo-600 hover:bg-gray-50">
                          <KeyRound size={14} /> Reset Password
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {data && data.total > data.limit && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              Showing {((page - 1) * data.limit) + 1}–{Math.min(page * data.limit, data.total)} of {data.total}
            </p>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                className="px-3 py-1 text-xs border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50">Previous</button>
              <button disabled={page * data.limit >= data.total} onClick={() => setPage(p => p + 1)}
                className="px-3 py-1 text-xs border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Create User Modal */}
      {showCreate && (
        <Modal title="Create New User" onClose={() => setShowCreate(false)}>
          <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(form) }} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="First Name">
                <input required value={form.firstName} onChange={(e) => setForm(f => ({ ...f, firstName: e.target.value }))} className="input" placeholder="John" />
              </Field>
              <Field label="Last Name">
                <input required value={form.lastName} onChange={(e) => setForm(f => ({ ...f, lastName: e.target.value }))} className="input" placeholder="Doe" />
              </Field>
            </div>
            <Field label="Email">
              <input type="email" required value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} className="input" placeholder="user@university.edu" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Role">
                <select required value={form.role} onChange={(e) => setForm(f => ({ ...f, role: e.target.value as any }))} className="input">
                  <option value="student">Student</option>
                  <option value="teacher">Teacher</option>
                  <option value="academic_coordinator">Academic Coordinator</option>
                  <option value="dean">Dean</option>
                  <option value="admin">Admin</option>
                </select>
              </Field>
              <Field label="Auth Method">
                <select value={form.authProvider} onChange={(e) => setForm(f => ({ ...f, authProvider: e.target.value as any }))} className="input">
                  <option value="email">Email / Password</option>
                  <option value="google">Google</option>
                </select>
              </Field>
            </div>
            {form.authProvider === 'email' && (
              <Field label="Password">
                <input type="password" required value={form.password ?? ''} onChange={(e) => { setForm(f => ({ ...f, password: e.target.value })); setShowPassRules(true) }} className="input" placeholder="••••••••" />
                {showPassRules && form.password && (
                  <ul className="mt-1.5 space-y-0.5">
                    {PASSWORD_RULES.map(r => {
                      const ok = r.test(form.password ?? '')
                      return <li key={r.label} className={`flex items-center gap-1.5 text-xs ${ok ? 'text-green-600' : 'text-gray-400'}`}><span>{ok ? '✓' : '○'}</span>{r.label}</li>
                    })}
                  </ul>
                )}
              </Field>
            )}
            {createMutation.error && (
              <p className="text-red-600 text-sm">{(createMutation.error as any)?.response?.data?.error ?? 'Error creating user.'}</p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowCreate(false)} className="btn-ghost">Cancel</button>
              <button type="submit" disabled={createMutation.isPending} className="btn-primary">
                {createMutation.isPending ? 'Creating…' : 'Create User'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Reset Password Modal */}
      {resetTarget && (
        <Modal title={`Reset Password — ${resetTarget.firstName} ${resetTarget.lastName}`} onClose={() => setResetTarget(null)}>
          <form onSubmit={(e) => { e.preventDefault(); resetMutation.mutate({ id: resetTarget.id, password: newPassword }) }} className="space-y-4">
            <Field label="New Password">
              <input type="password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="input" placeholder="••••••••" />
              {newPassword && (
                <ul className="mt-1.5 space-y-0.5">
                  {PASSWORD_RULES.map(r => {
                    const ok = r.test(newPassword)
                    return <li key={r.label} className={`flex items-center gap-1.5 text-xs ${ok ? 'text-green-600' : 'text-gray-400'}`}><span>{ok ? '✓' : '○'}</span>{r.label}</li>
                  })}
                </ul>
              )}
            </Field>
            {resetMutation.error && (
              <p className="text-red-600 text-sm">{(resetMutation.error as any)?.response?.data?.error ?? 'Error resetting password.'}</p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setResetTarget(null)} className="btn-ghost">Cancel</button>
              <button type="submit" disabled={resetMutation.isPending} className="btn-primary">
                {resetMutation.isPending ? 'Resetting…' : 'Reset Password'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400"><X size={16} /></button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  )
}
