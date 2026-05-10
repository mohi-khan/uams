'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import { useSetAtom } from 'jotai'
import { GoogleLogin } from '@react-oauth/google'
import { loginApi, googleLoginApi, devLoginApi } from '@/lib/api/auth'
import { accessTokenAtom, refreshTokenAtom, currentUserAtom } from '@/store/auth'

const PASSWORD_RULES = [
  { label: 'At least 8 characters',           test: (v: string) => v.length >= 8 },
  { label: 'One uppercase letter',             test: (v: string) => /[A-Z]/.test(v) },
  { label: 'One lowercase letter',             test: (v: string) => /[a-z]/.test(v) },
  { label: 'One number',                       test: (v: string) => /[0-9]/.test(v) },
  { label: 'One special character (@#$!...)',  test: (v: string) => /[^A-Za-z0-9]/.test(v) },
]

export default function LoginPage() {
  const router = useRouter()
  const setAccessToken  = useSetAtom(accessTokenAtom)
  const setRefreshToken = useSetAtom(refreshTokenAtom)
  const setCurrentUser  = useSetAtom(currentUserAtom)

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [showRules, setShowRules] = useState(false)

  const onAuthSuccess = (data: { accessToken: string; refreshToken: string; user: any }) => {
    setAccessToken(data.accessToken)
    setRefreshToken(data.refreshToken)
    setCurrentUser(data.user)
    router.push('/dashboard')
  }

  const { mutate, isPending, error } = useMutation({
    mutationFn: loginApi,
    onSuccess: onAuthSuccess,
  })

  const googleMut = useMutation({
    mutationFn: (idToken: string) => googleLoginApi(idToken),
    onSuccess: onAuthSuccess,
  })

  const devMut = useMutation({
    mutationFn: () => devLoginApi('74df7a19-4405-4982-9367-05c564b162f7'),
    onSuccess: onAuthSuccess,
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    mutate({ email, password })
  }

  const errorMessage = error instanceof Error ? error.message
    : (error as any)?.response?.data?.error ?? 'Something went wrong.'

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
          <h1 className="text-2xl font-bold text-gray-900">Sign in to your account</h1>
          <p className="text-sm text-gray-500 mt-1">Enter your credentials to continue</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@university.edu"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setShowRules(true) }}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
                >
                  {showPass ? 'Hide' : 'Show'}
                </button>
              </div>

              {/* Password strength rules */}
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

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
                {errorMessage}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isPending}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm"
            >
              {isPending ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400">or</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* Google Sign-In */}
          <div className="flex justify-center">
            <GoogleLogin
              onSuccess={(cred) => {
                if (cred.credential) googleMut.mutate(cred.credential)
              }}
              onError={() => {}}
              width="368"
              text="signin_with"
              shape="rectangular"
            />
          </div>
          {googleMut.error && (
            <p className="mt-3 text-center text-sm text-red-600">
              {(googleMut.error as any)?.response?.data?.error ?? 'Google sign-in failed.'}
            </p>
          )}

          {/* Dev-only bypass button */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-5 pt-5 border-t border-dashed border-amber-300">
              <p className="text-xs text-amber-500 text-center mb-2 font-mono">⚙ DEV ONLY</p>
              <button
                type="button"
                onClick={() => devMut.mutate()}
                disabled={devMut.isPending}
                className="w-full bg-amber-50 hover:bg-amber-100 disabled:opacity-50 text-amber-700 border border-amber-300 font-medium py-2 rounded-lg transition-colors text-sm"
              >
                {devMut.isPending ? 'Logging in…' : 'Test Login — Student #TEST-001'}
              </button>
              {devMut.error && (
                <p className="mt-2 text-center text-xs text-red-500">
                  {(devMut.error as any)?.response?.data?.error ?? 'Dev login failed.'}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer links */}
        <p className="text-center text-sm text-gray-500 mt-6">
          Want to register your university?{' '}
          <Link href="/register" className="text-indigo-600 font-medium hover:underline">
            Get started
          </Link>
        </p>
      </div>
    </main>
  )
}
