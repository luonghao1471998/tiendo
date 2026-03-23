import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'

import client from '@/api/client'
import { parseApiError } from '@/lib/parseApiError'
import useAuthStore from '@/stores/authStore'

export default function MustChangePasswordPage() {
  const navigate = useNavigate()
  const { user, me, logout } = useAuthStore()
  const [currentPassword, setCurrentPassword] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!user?.must_change_password) {
    return <Navigate to="/projects" replace />
  }

  const fieldCls =
    'w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2.5 text-sm text-[#0F172A] transition focus:border-[#FF7F29] focus:outline-none focus:ring-2 focus:ring-[#FF7F29]/30'

  const submit = async () => {
    setSaving(true)
    setError(null)
    try {
      await client.patch('/auth/me/password', {
        current_password: currentPassword,
        password,
        password_confirmation: passwordConfirmation,
      })
      await me()
      navigate('/projects', { replace: true })
    } catch (err) {
      setError(parseApiError(err, 'Đổi mật khẩu thất bại.'))
    } finally {
      setSaving(false)
    }
  }

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <main
      className="flex min-h-screen w-full items-center justify-center px-4 py-10"
      style={{
        background: '#F8FAFC',
        backgroundImage:
          'radial-gradient(circle at 20% 20%, #FFF3E8 0%, transparent 50%), radial-gradient(circle at 80% 80%, #FFF3E8 0%, transparent 50%)',
      }}
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_25px_50px_-12px_rgba(15,23,42,0.35)]">
        <div className="border-b border-[#E2E8F0] bg-[#F8FAFC] px-6 py-4">
          <div className="border-l-4 border-[#FF7F29] pl-3">
            <h1 className="text-lg font-semibold text-[#0F172A]">Đặt mật khẩu mới</h1>
            <p className="mt-1 text-xs text-[#64748B]">
              Tài khoản của bạn đang dùng mật khẩu tạm từ lời mời. Vui lòng đổi mật khẩu ngay để tiếp tục.
            </p>
          </div>
        </div>
        <div className="space-y-4 px-6 py-5">
          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          ) : null}
          <div>
            <label className="mb-1 block text-xs font-medium text-[#64748B]">Mật khẩu hiện tại (mật khẩu tạm)</label>
            <input
              type="password"
              autoComplete="current-password"
              className={fieldCls}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#64748B]">Mật khẩu mới (tối thiểu 8 ký tự)</label>
            <input
              type="password"
              autoComplete="new-password"
              className={fieldCls}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#64748B]">Xác nhận mật khẩu mới</label>
            <input
              type="password"
              autoComplete="new-password"
              className={fieldCls}
              value={passwordConfirmation}
              onChange={(e) => setPasswordConfirmation(e.target.value)}
            />
          </div>
        </div>
        <div className="flex flex-col gap-2 border-t border-[#E2E8F0] bg-[#F8FAFC] px-6 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="cursor-pointer rounded-xl border border-[#E2E8F0] bg-white px-4 py-2 text-sm text-[#64748B] transition hover:bg-[#F1F5F9]"
          >
            Đăng xuất
          </button>
          <button
            type="button"
            disabled={
              saving || !currentPassword || !password || password !== passwordConfirmation || password.length < 8
            }
            onClick={() => void submit()}
            className="cursor-pointer rounded-xl bg-[#FF7F29] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#E5691D] disabled:opacity-60"
          >
            {saving ? 'Đang lưu...' : 'Lưu và tiếp tục'}
          </button>
        </div>
      </div>
    </main>
  )
}
