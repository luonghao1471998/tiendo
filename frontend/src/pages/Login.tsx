import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'

import useAuthStore from '@/stores/authStore'

function parseApiError(error: unknown): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof (error as { response?: unknown }).response === 'object' &&
    (error as { response?: { data?: unknown } }).response?.data &&
    typeof (error as { response?: { data?: { error?: { message?: unknown } } } }).response?.data ===
      'object'
  ) {
    const apiMessage = (error as { response?: { data?: { error?: { message?: unknown } } } }).response
      ?.data?.error?.message
    if (typeof apiMessage === 'string' && apiMessage.length > 0) {
      return apiMessage
    }
  }
  return 'Đăng nhập thất bại. Vui lòng thử lại.'
}

export default function Login() {
  const navigate = useNavigate()
  const { login, token, loading } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (token) {
    return <Navigate to="/projects" replace />
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    try {
      await login(email.trim(), password)
      navigate('/projects', { replace: true })
    } catch (err) {
      setError(parseApiError(err))
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6">
      <h1 className="mb-2 text-3xl font-semibold">TienDo</h1>
      <p className="mb-6 text-sm text-muted-foreground">Đăng nhập để quản lý tiến độ công trường</p>

      <form className="space-y-4 rounded-xl border bg-card p-5" onSubmit={handleSubmit}>
        <label className="block text-sm font-medium">
          Email
          <input
            className="mt-1 w-full rounded-md border bg-background px-3 py-2"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoComplete="email"
          />
        </label>

        <label className="block text-sm font-medium">
          Mật khẩu
          <input
            className="mt-1 w-full rounded-md border bg-background px-3 py-2"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            autoComplete="current-password"
          />
        </label>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <button
          className="w-full rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-60"
          type="submit"
          disabled={loading}
        >
          {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
        </button>
      </form>
    </main>
  )
}

