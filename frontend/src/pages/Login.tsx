import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'

import useAuthStore from '@/stores/authStore'

function parseLoginError(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const resp = (error as { response?: { data?: { error?: { message?: unknown; details?: unknown } } } }).response
    const msg = resp?.data?.error?.message
    if (typeof msg === 'string' && msg) return msg
  }
  return 'Đăng nhập thất bại. Vui lòng kiểm tra email và mật khẩu.'
}

export default function Login() {
  const navigate = useNavigate()
  const { login, token } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (token) {
    return <Navigate to="/projects" replace />
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await login(email.trim(), password)
      navigate('/projects', { replace: true })
    } catch (err) {
      setError(parseLoginError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main
      className="flex min-h-screen w-full items-center justify-center px-4"
      style={{
        background: '#F8FAFC',
        backgroundImage:
          'radial-gradient(circle at 20% 20%, #FFF3E8 0%, transparent 50%), radial-gradient(circle at 80% 80%, #FFF3E8 0%, transparent 50%)',
      }}
    >
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-[#FF7F29] shadow-lg">
            <span className="text-2xl font-black text-white">T</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-[#FF7F29]">TienDo</h1>
          <p className="mt-1.5 text-sm text-[#64748B]">Quản lý tiến độ thi công trực quan</p>
        </div>

        {/* Card */}
        <form
          className="rounded-2xl border border-[#E2E8F0] bg-white p-8 shadow-lg"
          onSubmit={handleSubmit}
        >
          <h2 className="mb-6 text-lg font-semibold text-[#0F172A]">Đăng nhập</h2>

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#0F172A]">Email</label>
              <input
                className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2.5 text-sm text-[#0F172A] placeholder:text-[#94A3B8] transition focus:border-[#FF7F29] focus:outline-none focus:ring-2 focus:ring-[#FF7F29]/30"
                type="email"
                placeholder="admin@company.vn"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#0F172A]">Mật khẩu</label>
              <input
                className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2.5 text-sm text-[#0F172A] placeholder:text-[#94A3B8] transition focus:border-[#FF7F29] focus:outline-none focus:ring-2 focus:ring-[#FF7F29]/30"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
          </div>

          {error ? (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <button
            className="mt-6 w-full cursor-pointer rounded-xl bg-[#FF7F29] py-2.5 text-sm font-semibold text-white transition-all duration-150 hover:bg-[#E5691D] disabled:cursor-not-allowed disabled:opacity-60"
            type="submit"
            disabled={loading}
          >
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-[#64748B]">
          © {new Date().getFullYear()} Ánh Dương Construction
        </p>
      </div>
    </main>
  )
}
