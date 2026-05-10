'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { registerTenant, type Tier } from '@/lib/api/tenant'

const TIERS: { value: Tier; label: string }[] = [
  { value: '0-50',      label: '0 – 50 users' },
  { value: '51-100',    label: '51 – 100 users' },
  { value: '101-500',   label: '101 – 500 users' },
  { value: '501-1000',  label: '501 – 1,000 users' },
  { value: '1001+',     label: '1,001+ users' },
]

export default function RegisterPage() {
  const router = useRouter()
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({
    universityName:  '',
    universityEmail: '',
    phone:           '',
    address:         '',
    city:            '',
    country:         '',
    tier:            '' as Tier,
    firstName:       '',
    lastName:        '',
    adminEmail:      '',
    password:        '',
    confirmPassword: '',
  })

  const set = (field: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      await registerTenant({
        universityName:  form.universityName,
        universityEmail: form.universityEmail,
        phone:           form.phone || undefined,
        address:         form.address || undefined,
        city:            form.city || undefined,
        country:         form.country,
        tier:            form.tier,
        firstName:       form.firstName,
        lastName:        form.lastName,
        adminEmail:      form.adminEmail,
        password:        form.password,
      })
      router.push('/check-email')
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 w-full max-w-2xl p-8">

        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Register your University</h1>
          <p className="text-gray-500 mt-1 text-sm">Set up your institution on UAMS. Free to start.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">

          {/* University Info */}
          <section>
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
              University Information
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Field label="University Name *" value={form.universityName} onChange={set('universityName')} placeholder="e.g. Massachusetts Institute of Technology" required />
              </div>
              <Field label="Official Email *" type="email" value={form.universityEmail} onChange={set('universityEmail')} placeholder="admin@university.edu" required />
              <Field label="Phone" type="tel" value={form.phone} onChange={set('phone')} placeholder="+1 555 000 0000" />
              <div className="sm:col-span-2">
                <Field label="Address" value={form.address} onChange={set('address')} placeholder="Street address" />
              </div>
              <Field label="City" value={form.city} onChange={set('city')} placeholder="City" />
              <Field label="Country *" value={form.country} onChange={set('country')} placeholder="Country" required />
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Expected Users *
              </label>
              <select
                required
                value={form.tier}
                onChange={set('tier')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="" disabled>Select user range</option>
                {TIERS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </section>

          <hr className="border-gray-100" />

          {/* Admin Account */}
          <section>
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
              Admin Account
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="First Name *" value={form.firstName} onChange={set('firstName')} placeholder="First name" required />
              <Field label="Last Name *"  value={form.lastName}  onChange={set('lastName')}  placeholder="Last name"  required />
              <div className="sm:col-span-2">
                <Field label="Admin Email *" type="email" value={form.adminEmail} onChange={set('adminEmail')} placeholder="you@university.edu" required />
              </div>
              <Field label="Password *" type="password" value={form.password} onChange={set('password')} placeholder="Min. 8 characters" required />
              <Field label="Confirm Password *" type="password" value={form.confirmPassword} onChange={set('confirmPassword')} placeholder="Repeat password" required />
            </div>
          </section>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold py-3 rounded-lg transition-colors"
          >
            {loading ? 'Registering...' : 'Register University'}
          </button>

          <p className="text-center text-sm text-gray-500">
            Already registered?{' '}
            <a href="/login" className="text-indigo-600 font-medium hover:underline">Sign in</a>
          </p>
        </form>
      </div>
    </main>
  )
}

function Field({
  label, type = 'text', value, onChange, placeholder, required,
}: {
  label: string
  type?: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  placeholder?: string
  required?: boolean
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
    </div>
  )
}
