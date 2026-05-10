'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAtomValue } from 'jotai'
import { currentUserAtom } from '@/store/auth'
import {
  Users, Search, MoreVertical, Pencil, Trash2, History,
  X, Plus, CheckCircle, XCircle, Upload, ImageIcon, Loader2,
  Eye, EyeOff, ShieldAlert,
} from 'lucide-react'
import {
  listStudentsApi, createStudentApi, updateStudentApi,
  deleteStudentApi, getStudentAuditLogsApi, uploadStudentPhoto,
  revealStudentNidApi, type StudentRow,
} from '@/lib/api/students'
import type { AuditLogEntry } from '@/lib/api/academic'

const PAGE_SIZE = 20

type CreateForm = {
  studentCode: string; name: string; email: string; gmailAccount: string; phone: string
  address: string; emergencyPhone: string; nidBirthReg: string; photoUrl: string
}
type EditForm = Omit<CreateForm, 'email'>

const emptyCreate: CreateForm = {
  studentCode: '', name: '', email: '', gmailAccount: '', phone: '',
  address: '', emergencyPhone: '', nidBirthReg: '', photoUrl: '',
}

export default function StudentsPage() {
  const qc       = useQueryClient()
  const user     = useAtomValue(currentUserAtom)
  const canWrite = user?.role === 'admin' || user?.role === 'super_admin'

  const [search,       setSearch]       = useState('')
  const [menuId,       setMenuId]       = useState<string | null>(null)
  const [showCreate,   setShowCreate]   = useState(false)
  const [editTarget,   setEditTarget]   = useState<StudentRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<StudentRow | null>(null)
  const [auditTarget,  setAuditTarget]  = useState<StudentRow | null>(null)
  const [createForm,   setCreateForm]   = useState<CreateForm>(emptyCreate)
  const [editForm,     setEditForm]     = useState<EditForm>({
    studentCode: '', name: '', gmailAccount: '', phone: '', address: '', emergencyPhone: '', nidBirthReg: '', photoUrl: '',
  })
  const [uploading,    setUploading]    = useState(false)
  const [revealTarget, setRevealTarget] = useState<StudentRow | null>(null)
  const [revealPwd,    setRevealPwd]    = useState('')
  const [revealedNids, setRevealedNids] = useState<Record<string, string>>({})
  const [showRevealPwd, setShowRevealPwd] = useState(false)
  const fileRef     = useRef<HTMLInputElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)

  // ── Infinite query ──────────────────────────────────────────────────────────
  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: ['students', search],
    queryFn:  ({ pageParam = 1 }) =>
      listStudentsApi(pageParam as number, search || undefined, PAGE_SIZE),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const loaded = lastPage.page * lastPage.limit
      return loaded < lastPage.total ? lastPage.page + 1 : undefined
    },
  })

  const rows: StudentRow[] = data?.pages.flatMap((p) => p.data) ?? []

  // ── Intersection Observer: load next page when sentinel is visible ──────────
  const onIntersect = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage()
      }
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage],
  )

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(onIntersect, { threshold: 0.1 })
    observer.observe(el)
    return () => observer.disconnect()
  }, [onIntersect])

  // ── Audit query ─────────────────────────────────────────────────────────────
  const { data: auditData, isLoading: auditLoading } = useQuery({
    queryKey: ['student-audit', auditTarget?.id],
    queryFn:  () => getStudentAuditLogsApi(auditTarget!.id),
    enabled:  !!auditTarget,
  })

  // ── Mutations ───────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: () => createStudentApi({
      studentCode:    createForm.studentCode,
      name:           createForm.name,
      email:          createForm.email,
      gmailAccount:   createForm.gmailAccount,
      phone:          createForm.phone          || undefined,
      address:        createForm.address        || undefined,
      emergencyPhone: createForm.emergencyPhone || undefined,
      nidBirthReg:    createForm.nidBirthReg    || undefined,
      photoUrl:       createForm.photoUrl       || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['students'] })
      setShowCreate(false)
      setCreateForm(emptyCreate)
    },
  })

  const updateMutation = useMutation({
    mutationFn: () => updateStudentApi(editTarget!.id, {
      studentCode:    editForm.studentCode    || undefined,
      name:           editForm.name           || undefined,
      gmailAccount:   editForm.gmailAccount   || undefined,
      phone:          editForm.phone          || null,
      address:        editForm.address        || null,
      emergencyPhone: editForm.emergencyPhone || null,
      nidBirthReg:    editForm.nidBirthReg    || null,
      photoUrl:       editForm.photoUrl       || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['students'] })
      setEditTarget(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteStudentApi,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['students'] })
      setDeleteTarget(null)
    },
  })

  const revealMutation = useMutation({
    mutationFn: (studentId: string) => revealStudentNidApi(studentId, revealPwd),
    onSuccess: (res, studentId) => {
      setRevealedNids(prev => ({ ...prev, [studentId]: res.nid }))
      setRevealTarget(null)
      setRevealPwd('')
      setShowRevealPwd(false)
    },
  })

  // ── Photo upload ─────────────────────────────────────────────────────────────
  async function handlePhotoSelect(
    e: React.ChangeEvent<HTMLInputElement>,
    target: 'create' | 'edit',
  ) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const url = await uploadStudentPhoto(file)
      if (target === 'create') setCreateForm(f => ({ ...f, photoUrl: url }))
      else                     setEditForm(f   => ({ ...f, photoUrl: url }))
    } catch {
      alert('Photo upload failed. Please try again.')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  function openEdit(s: StudentRow) {
    setEditTarget(s)
    setEditForm({
      studentCode:    s.studentCode,
      name:           s.name,
      gmailAccount:   s.gmailAccount   ?? '',
      phone:          s.phone          ?? '',
      address:        s.address        ?? '',
      emergencyPhone: s.emergencyPhone ?? '',
      nidBirthReg:    '',   // never pre-fill with masked value; leave blank to keep existing
      photoUrl:       s.photoUrl       ?? '',
    })
    setMenuId(null)
  }

  const totalLoaded = rows.length
  const grandTotal  = data?.pages[0]?.total ?? 0

  return (
    <div className="max-w-6xl mx-auto space-y-5">

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, code, email…"
            className="pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 w-72"
          />
        </div>
        <div className="flex items-center gap-3">
          {grandTotal > 0 && (
            <span className="text-xs text-gray-400">
              {totalLoaded} of {grandTotal}
            </span>
          )}
          {canWrite && (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              <Plus size={15} /> Add Student
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {['Student', 'Code', 'Gmail (Login)', 'Contact', 'Emergency', 'NID / Birth Reg', 'Status', ''].map((h) => (
                <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading && (
              <tr><td colSpan={8} className="text-center py-10 text-gray-400 text-sm">Loading…</td></tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr><td colSpan={8} className="text-center py-10 text-gray-400 text-sm">No students found.</td></tr>
            )}
            {rows.map((s) => (
              <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {s.photoUrl
                      ? <img src={s.photoUrl} alt="" className="w-8 h-8 rounded-full object-cover shrink-0 border border-gray-200" />
                      : <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                          <Users size={13} className="text-indigo-500" />
                        </div>
                    }
                    <div>
                      <p className="font-medium text-gray-900">{s.name}</p>
                      <p className="text-xs text-gray-400">{s.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="font-mono text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">{s.studentCode}</span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {s.gmailAccount
                    ? <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />{s.gmailAccount}</span>
                    : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  <p>{s.phone ?? '—'}</p>
                  <p className="text-gray-400 truncate max-w-[140px]">{s.address ?? ''}</p>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">{s.emergencyPhone ?? '—'}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {s.nidBirthReg
                    ? (
                      <div className="flex items-center gap-1.5">
                        {revealedNids[s.id]
                          ? <span className="font-mono text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded text-xs">{revealedNids[s.id]}</span>
                          : <span className="font-mono tracking-widest text-gray-300">{s.nidBirthReg}</span>
                        }
                        {canWrite && (
                          revealedNids[s.id]
                            ? <button onClick={() => setRevealedNids(p => { const n = { ...p }; delete n[s.id]; return n })}
                                title="Hide" className="text-amber-400 hover:text-amber-600">
                                <EyeOff size={13} />
                              </button>
                            : <button onClick={() => { setRevealTarget(s); setRevealPwd(''); setShowRevealPwd(false); revealMutation.reset() }}
                                title="Reveal NID" className="text-gray-300 hover:text-indigo-500 transition-colors">
                                <Eye size={13} />
                              </button>
                        )}
                      </div>
                    )
                    : <span>—</span>
                  }
                </td>
                <td className="px-4 py-3">
                  {s.isActive
                    ? <span className="flex items-center gap-1 text-xs text-green-600"><CheckCircle size={13} /> Active</span>
                    : <span className="flex items-center gap-1 text-xs text-gray-400"><XCircle size={13} /> Inactive</span>}
                </td>
                <td className="px-4 py-3 relative">
                  <button
                    onClick={() => setMenuId(menuId === s.id ? null : s.id)}
                    className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                  >
                    <MoreVertical size={15} />
                  </button>
                  {menuId === s.id && (
                    <div className="absolute right-8 top-2 z-20 bg-white border border-gray-200 rounded-xl shadow-lg py-1 w-44">
                      {canWrite && (
                        <button onClick={() => openEdit(s)}
                          className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                          <Pencil size={14} /> Edit
                        </button>
                      )}
                      <button onClick={() => { setAuditTarget(s); setMenuId(null) }}
                        className="flex items-center gap-2 w-full px-4 py-2 text-sm text-indigo-600 hover:bg-gray-50">
                        <History size={14} /> History
                      </button>
                      {canWrite && (
                        <button onClick={() => { setDeleteTarget(s); setMenuId(null) }}
                          className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-gray-50">
                          <Trash2 size={14} /> Delete
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Scroll sentinel + loader */}
        <div ref={sentinelRef} className="h-1" />
        {isFetchingNextPage && (
          <div className="flex justify-center py-4">
            <Loader2 size={18} className="animate-spin text-indigo-400" />
          </div>
        )}
        {!hasNextPage && rows.length > 0 && (
          <p className="text-center text-xs text-gray-300 py-3">All {grandTotal} students loaded</p>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <Modal title="Add Student" onClose={() => { setShowCreate(false); setCreateForm(emptyCreate) }}>
          <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate() }} className="space-y-4">
            <PhotoPicker
              photoUrl={createForm.photoUrl}
              uploading={uploading}
              inputRef={fileRef}
              onChange={(e) => handlePhotoSelect(e, 'create')}
              onClear={() => setCreateForm(f => ({ ...f, photoUrl: '' }))}
            />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Student Code">
                <input required value={createForm.studentCode}
                  onChange={(e) => setCreateForm(f => ({ ...f, studentCode: e.target.value }))}
                  className="input" placeholder="STU-2026-001" />
              </Field>
              <Field label="Full Name">
                <input required value={createForm.name}
                  onChange={(e) => setCreateForm(f => ({ ...f, name: e.target.value }))}
                  className="input" placeholder="Jane Smith" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Contact Email">
                <input required type="email" value={createForm.email}
                  onChange={(e) => setCreateForm(f => ({ ...f, email: e.target.value }))}
                  className="input" placeholder="jane@university.edu" />
              </Field>
              <Field label="Gmail Account (Login)">
                <input required type="email" value={createForm.gmailAccount}
                  onChange={(e) => setCreateForm(f => ({ ...f, gmailAccount: e.target.value }))}
                  className="input" placeholder="jane@gmail.com" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Phone">
                <input value={createForm.phone}
                  onChange={(e) => setCreateForm(f => ({ ...f, phone: e.target.value }))}
                  className="input" placeholder="+1 555 000 0000" />
              </Field>
              <Field label="Emergency Phone">
                <input value={createForm.emergencyPhone}
                  onChange={(e) => setCreateForm(f => ({ ...f, emergencyPhone: e.target.value }))}
                  className="input" placeholder="+1 555 111 1111" />
              </Field>
            </div>
            <Field label="Address">
              <textarea value={createForm.address}
                onChange={(e) => setCreateForm(f => ({ ...f, address: e.target.value }))}
                className="input resize-none" rows={2} placeholder="Street, City, Country" />
            </Field>
            <Field label="NID / Birth Registration">
              <input value={createForm.nidBirthReg}
                onChange={(e) => setCreateForm(f => ({ ...f, nidBirthReg: e.target.value }))}
                className="input" placeholder="1234567890" />
            </Field>
            {createMutation.error && (
              <p className="text-red-600 text-sm">{(createMutation.error as any)?.response?.data?.error ?? 'Error creating student.'}</p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => { setShowCreate(false); setCreateForm(emptyCreate) }} className="btn-ghost">Cancel</button>
              <button type="submit" disabled={createMutation.isPending || uploading} className="btn-primary">
                {createMutation.isPending ? 'Saving…' : 'Save Student'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Modal */}
      {editTarget && (
        <Modal title={`Edit — ${editTarget.name}`} onClose={() => setEditTarget(null)}>
          <form onSubmit={(e) => { e.preventDefault(); updateMutation.mutate() }} className="space-y-4">
            <PhotoPicker
              photoUrl={editForm.photoUrl}
              uploading={uploading}
              inputRef={fileRef}
              onChange={(e) => handlePhotoSelect(e, 'edit')}
              onClear={() => setEditForm(f => ({ ...f, photoUrl: '' }))}
            />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Student Code">
                <input required value={editForm.studentCode}
                  onChange={(e) => setEditForm(f => ({ ...f, studentCode: e.target.value }))}
                  className="input" />
              </Field>
              <Field label="Full Name">
                <input required value={editForm.name}
                  onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))}
                  className="input" />
              </Field>
            </div>
            <p className="text-xs text-indigo-500 bg-indigo-50 rounded-lg px-3 py-2">Contact email cannot be changed after creation.</p>
            <Field label="Gmail Account (Login)">
              <input type="email" value={editForm.gmailAccount}
                onChange={(e) => setEditForm(f => ({ ...f, gmailAccount: e.target.value }))}
                className="input" placeholder="jane@gmail.com" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Phone">
                <input value={editForm.phone}
                  onChange={(e) => setEditForm(f => ({ ...f, phone: e.target.value }))}
                  className="input" />
              </Field>
              <Field label="Emergency Phone">
                <input value={editForm.emergencyPhone}
                  onChange={(e) => setEditForm(f => ({ ...f, emergencyPhone: e.target.value }))}
                  className="input" />
              </Field>
            </div>
            <Field label="Address">
              <textarea value={editForm.address}
                onChange={(e) => setEditForm(f => ({ ...f, address: e.target.value }))}
                className="input resize-none" rows={2} />
            </Field>
            <Field label="NID / Birth Registration">
              <input value={editForm.nidBirthReg}
                onChange={(e) => setEditForm(f => ({ ...f, nidBirthReg: e.target.value }))}
                className="input" placeholder="Leave blank to keep existing" />
              <p className="text-xs text-gray-400 mt-1">Sensitive field — leave blank to keep the current value unchanged.</p>
            </Field>
            {updateMutation.error && (
              <p className="text-red-600 text-sm">{(updateMutation.error as any)?.response?.data?.error ?? 'Error updating student.'}</p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditTarget(null)} className="btn-ghost">Cancel</button>
              <button type="submit" disabled={updateMutation.isPending || uploading} className="btn-primary">
                {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete */}
      {deleteTarget && (
        <Modal title="Delete Student" onClose={() => setDeleteTarget(null)}>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Delete <strong>{deleteTarget.name}</strong> ({deleteTarget.studentCode})? This cannot be undone.
            </p>
            {deleteMutation.error && (
              <p className="text-red-600 text-sm">{(deleteMutation.error as any)?.response?.data?.error ?? 'Error deleting student.'}</p>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteTarget(null)} className="btn-ghost">Cancel</button>
              <button onClick={() => deleteMutation.mutate(deleteTarget.id)} disabled={deleteMutation.isPending}
                className="bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50">
                {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* NID Reveal — password gate */}
      {revealTarget && (
        <Modal
          title="Identity Verification Required"
          onClose={() => { setRevealTarget(null); setRevealPwd(''); setShowRevealPwd(false); revealMutation.reset() }}
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <ShieldAlert size={16} className="text-amber-500 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">
                You are about to view the NID / Birth Registration for{' '}
                <strong>{revealTarget.name}</strong>. This access is logged.
                Enter your password to continue.
              </p>
            </div>
            <Field label="Your Password">
              <div className="relative">
                <input
                  type={showRevealPwd ? 'text' : 'password'}
                  value={revealPwd}
                  onChange={(e) => setRevealPwd(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && revealPwd) revealMutation.mutate(revealTarget.id)
                  }}
                  className="input pr-10"
                  placeholder="••••••••"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowRevealPwd(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showRevealPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </Field>
            {revealMutation.error && (
              <p className="text-red-600 text-sm flex items-center gap-1.5">
                <ShieldAlert size={14} />
                {(revealMutation.error as any)?.response?.data?.error ?? 'Authentication failed.'}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => { setRevealTarget(null); setRevealPwd(''); setShowRevealPwd(false); revealMutation.reset() }}
                className="btn-ghost"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => revealMutation.mutate(revealTarget.id)}
                disabled={!revealPwd || revealMutation.isPending}
                className="btn-primary"
              >
                {revealMutation.isPending ? 'Verifying…' : 'Reveal NID'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Audit */}
      {auditTarget && (
        <Modal title={`History — ${auditTarget.name}`} onClose={() => setAuditTarget(null)}>
          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {auditLoading && <p className="text-center text-sm text-gray-400 py-6">Loading…</p>}
            {!auditLoading && auditData?.data.length === 0 && (
              <p className="text-center text-sm text-gray-400 py-6">No history yet.</p>
            )}
            {auditData?.data.map((entry) => <AuditEntry key={entry.id} entry={entry} />)}
          </div>
        </Modal>
      )}
    </div>
  )
}

function PhotoPicker({ photoUrl, uploading, inputRef, onChange, onClear }: {
  photoUrl: string
  uploading: boolean
  inputRef: React.RefObject<HTMLInputElement | null>
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onClear: () => void
}) {
  return (
    <div className="flex items-center gap-4">
      <div className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden bg-gray-50 shrink-0">
        {photoUrl
          ? <img src={photoUrl} alt="Photo" className="w-full h-full object-cover" />
          : <ImageIcon size={24} className="text-gray-300" />
        }
      </div>
      <div className="space-y-1.5">
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp"
          className="hidden" onChange={onChange} />
        <button type="button" disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 font-medium disabled:opacity-50">
          <Upload size={14} />
          {uploading ? 'Uploading…' : photoUrl ? 'Change Photo' : 'Upload Photo'}
        </button>
        {photoUrl && (
          <button type="button" onClick={onClear} className="text-xs text-red-500 hover:underline">Remove</button>
        )}
        <p className="text-xs text-gray-400">JPG, PNG or WebP · max 5 MB</p>
      </div>
    </div>
  )
}

function AuditEntry({ entry }: { entry: AuditLogEntry }) {
  const [expanded, setExpanded] = useState(false)
  const badge: Record<string, string> = {
    CREATE: 'bg-green-100 text-green-700',
    UPDATE: 'bg-blue-100 text-blue-700',
    DELETE: 'bg-red-100 text-red-700',
  }
  return (
    <div className="border border-gray-100 rounded-lg p-3 space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badge[entry.action]}`}>{entry.action}</span>
          <span className="text-sm text-gray-700">{entry.performedByName}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{new Date(entry.createdAt).toLocaleString()}</span>
          <button onClick={() => setExpanded(e => !e)} className="text-xs text-indigo-500 hover:underline">
            {expanded ? 'Hide' : 'Details'}
          </button>
        </div>
      </div>
      {expanded && (
        <pre className="text-xs bg-gray-50 rounded p-2 overflow-auto max-h-48 text-gray-600 leading-relaxed">
          {JSON.stringify(entry.snapshot, null, 2)}
        </pre>
      )}
    </div>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl">
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
