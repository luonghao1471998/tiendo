import { useState } from 'react'

import AppFormModal, { appFormInputClass, appFormLabelClass } from '@/components/ui/AppFormModal'

type Props = {
  open: boolean
  title: string
  onClose: () => void
  onSubmit: (password: string, passwordConfirmation: string) => Promise<void>
}

export default function AdminSetPasswordModal({ open, title, onClose, onSubmit }: Props) {
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const resetForm = () => {
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
      await onSubmit(password, passwordConfirmation)
      resetForm()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Thất bại.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppFormModal
      open={open}
      onClose={handleClose}
      title={title}
      subtitle="Mật khẩu mới tối thiểu 8 ký tự. Người dùng sẽ đăng nhập bằng mật khẩu này."
      ariaLabelledBy="admin-set-pw-title"
      footer={
        <>
          <button type="button" className="rounded-md border px-4 py-2 text-sm" onClick={handleClose}>
            Hủy
          </button>
          <button
            type="button"
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-60"
            disabled={saving || !password || password !== passwordConfirmation || password.length < 8}
            onClick={() => void submit()}
          >
            {saving ? 'Đang lưu...' : 'Đặt lại mật khẩu'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
          {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
          <div className="space-y-3">
            <div>
              <label className={appFormLabelClass} htmlFor="asp-new">
                Mật khẩu mới
              </label>
              <input
                id="asp-new"
                type="password"
                autoComplete="new-password"
                className={appFormInputClass}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div>
              <label className={appFormLabelClass} htmlFor="asp-confirm">
                Xác nhận mật khẩu
              </label>
              <input
                id="asp-confirm"
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
