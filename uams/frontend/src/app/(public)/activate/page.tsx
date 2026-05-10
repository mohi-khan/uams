'use client'

import { useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import { activateInvitationApi } from '@/lib/api/auth'

const PASSWORD_RULES = [
  { label: 'At least 8 characters',          test: (v: string) => v.length >= 8 },
  { label: 'One uppercase letter',            test: (v: string) => /[A-Z]/.test(v) },
  { label: 'One lowercase letter',            test: (v: string) => /[a-z]/.test(v) },
  { label: 'One number',                      test: (v: string) => /[0-9]/.test(v) },
  { label: 'One special character (@#$!...)', test: (v: string) => /[^A-Za-z0-9]/.test(v) },
]

export default function ActivatePage() {
  const searchParams = useSearchParams()
  const router       = useRouter()
  const token        = searchParams.get('token') ?? ''

  const [password,        setPassword]        = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPass,        setShowPass]        = useState(false)
  const [showConfirm,     setShowConfirm]     = useState(false)
  const [showRules,       setShowRules]       = useState(false)
  const [matchError,      setMatchError]      = useState('')

  const allRulesPassed = PASSWORD_RULES.every((r) => r.test(password))

  const { mutate, isPending, isSuccess, error } = useMutation({
    mutationFn: activateInvitationApi,
  })

  const errorMessage = (error as any)?.response?.data?.error ?? (error as any)?.message ?? 'Something went wrong.'

  if (!token) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 w-full max-w-md p-10 text-center">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Invalid Link</h1>
          <p className="text-gray-500 text-sm">This activation link is missing or malformed. Please check your invitation email.</p>
        </div>
      </main>
    )
  }

  if (isSuccess) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 w-full max-w-md p-10 text-center">
          <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Account Activated!</h1>
          <p className="text-gray-500 text-sm mb-8">
            Your password has been set. You can now sign in with your email and new password.
          </p>
          <button
            onClick={() => router.push('/login')}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm"
          >
            Go to Login
          </button>
        </div>
      </main>
    )
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMatchError('')
    if (password !== confirmPassword) {
      setMatchError('Passwords do not match.')
      return
    }
    if (!allRulesPassed) return
    mutate({ token, password })
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold">U</span>
            </div>
            <span className="font-bold text-gray-900 text-xl">UAMS</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Activate your account</h1>
          <p className="text-sm text-gray-500 mt-1">Set a password to complete your registration</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setShowRules(true) }}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition pr-14"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
                >
                  {showPass ? 'Hide' : 'Show'}
                </button>
              </div>

              {showRules && password.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {PASSWORD_RULES.map((rule) => {
                    const passed = rule.test(password)
                    return (
                      <li key={rule.label} className={`flex items-center gap-1.5 text-xs ${passed ? 'text-green-600' : 'text-gray-400'}`}>
                        <span>{passed ? '✓' : '○'}</span>
                        {rule.label}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setMatchError('') }}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition pr-14"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
                >
                  {showConfirm ? 'Hide' : 'Show'}
                </button>
              </div>
              {matchError && <p className="text-red-600 text-xs mt-1">{matchError}</p>}
            </div>

            {/* API error */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
                {errorMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={isPending || !allRulesPassed}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm"
            >
              {isPending ? 'Activating…' : 'Activate Account'}
            </button>

          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          This link is valid for 24 hours from the time the invitation was sent.
        </p>
      </div>
    </main>
  )
}
