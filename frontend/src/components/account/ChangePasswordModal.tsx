import { useState } from 'react'

import AppFormModal, { appFormInputClass, appFormLabelClass } from '@/components/ui/AppFormModal'
import client from '@/api/client'
import { parseApiError } from '@/lib/parseApiError'

type Props = {
  open: boolean
  onClose: () => void
}

export default function ChangePasswordModal({ open, onClose }: Props) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const resetForm = () => {
    setCurrentPassword('')
    setPassword('')
    setPasswordConfirmation('')
    setError(null)
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const submit = async () => {
    setSaving(true)
    setError(null)
    try {
      await client.patch('/auth/me/password', {
        current_password: currentPassword,
        password,
        password_confirmation: passwordConfirmation,
      })
      resetForm()
      onClose()
    } catch (err) {
      setError(parseApiError(err, 'Đổi mật khẩu thất bại.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppFormModal
      open={open}
      onClose={handleClose}
      title="Đổi mật khẩu"
      subtitle="Nhập mật khẩu hiện tại và mật khẩu mới (tối thiểu 8 ký tự)."
      ariaLabelledBy="change-pw-title"
      footer={
        <>
          <button type="button" className="rounded-md border px-4 py-2 text-sm" onClick={handleClose}>
            Hủy
          </button>
          <button
            type="button"
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-60"
            disabled={saving || !currentPassword || !password || password !== passwordConfirmation}
            onClick={() => void submit()}
          >
            {saving ? 'Đang lưu...' : 'Lưu mật khẩu'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
          {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
          <div className="space-y-3">
            <div>
              <label className={appFormLabelClass} htmlFor="cp-current">
                Mật khẩu hiện tại
              </label>
              <input
                id="cp-current"
                type="password"
                autoComplete="current-password"
                className={appFormInputClass}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div>
              <label className={appFormLabelClass} htmlFor="cp-new">
                Mật khẩu mới
              </label>
              <input
                id="cp-new"
                type="password"
                autoComplete="new-password"
                className={appFormInputClass}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div>
              <label className={appFormLabelClass} htmlFor="cp-confirm">
                Xác nhận mật khẩu mới
              </label>
              <input
                id="cp-confirm"
                type="password"
                autoComplete="new-password"
                className={appFormInputClass}
                value={passwordConfirmation}
                onChange={(e) => setPasswordConfirmation(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>
    </AppFormModal>
  )
}
