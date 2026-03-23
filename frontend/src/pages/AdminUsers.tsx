import { useEffect, useRef, useState } from 'react'
import { KeyRound, Pencil, Search, UserPlus } from 'lucide-react'
import { Navigate } from 'react-router-dom'

import AdminSetPasswordModal from '@/components/account/AdminSetPasswordModal'
import AppFormModal, { appFormInputClass, appFormLabelClass } from '@/components/ui/AppFormModal'
import client from '@/api/client'
import { platformUserRoleLabel } from '@/lib/roleLabels'
import { useDebouncedValue } from '@/lib/useDebouncedValue'
import useAuthStore from '@/stores/authStore'

type UserItem = {
  id: number
  name: string
  email: string
  role: 'admin' | 'project_manager' | 'field_team' | 'viewer' | null
  avatar_url?: string | null
  is_active: boolean
  created_at: string | null
}

type ApiListResponse<T> = {
  success: boolean
  data: T[]
  meta?: { current_page: number; per_page: number; total: number }
}

type ApiResponse<T> = { success: boolean; data: T }

const creatableRoles = ['project_manager', 'field_team', 'viewer'] as const
type CreatableRole = (typeof creatableRoles)[number]

function parseApiError(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const data = (error as { response?: { data?: { error?: { message?: unknown } } } }).response
      ?.data?.error?.message
    if (typeof data === 'string' && data) return data
  }
  return fallback
}

/** Nút thao tác — đồng bộ brand TienDo (cam #FF7F29) */
const btnEditCls =
  'inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[#FF7F29] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#FF7F29] shadow-sm transition hover:bg-[#FFF3E8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF7F29]/40'

const btnResetPwCls =
  'inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-1.5 text-xs font-semibold text-[#475569] transition hover:border-[#FF7F29]/50 hover:bg-[#FFF3E8] hover:text-[#FF7F29] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF7F29]/30'

const searchInputCls =
  'w-full max-w-sm rounded-lg border border-[#E2E8F0] bg-white py-2 pl-9 pr-3 text-sm text-[#0F172A] placeholder:text-[#94A3B8] transition focus:border-[#FF7F29] focus:outline-none focus:ring-2 focus:ring-[#FF7F29]/30'

export default function AdminUsers() {
  const { user } = useAuthStore()
  const [users, setUsers] = useState<UserItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editValues, setEditValues] = useState<{ name: string; email: string; is_active: boolean }>({
    name: '',
    email: '',
    is_active: true,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pwResetUser, setPwResetUser] = useState<UserItem | null>(null)
  const [nameSearch, setNameSearch] = useState('')
  const debouncedNameSearch = useDebouncedValue(nameSearch, 300)
  const emailRef = useRef<HTMLInputElement>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [createSubmitting, setCreateSubmitting] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createForm, setCreateForm] = useState<{
    name: string
    email: string
    password: string
    role: CreatableRole
    is_active: boolean
  }>({
    name: '',
    email: '',
    password: '',
    role: 'field_team',
    is_active: true,
  })

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number> = { per_page: 100 }
      const q = debouncedNameSearch.trim()
      if (q) params.search = q
      const resp = (await client.get('/users', { params })) as { data: ApiListResponse<UserItem> }
      setUsers(resp.data.data)
      setTotal(resp.data.meta?.total ?? resp.data.data.length)
    } catch {
      setError('Không tải được danh sách người dùng.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user?.role !== 'admin') return
    void fetchUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ refetch khi admin + ô tìm (debounced) đổi
  }, [user?.role, debouncedNameSearch])

  if (user?.role !== 'admin') {
    return <Navigate to="/projects" replace />
  }

  const startEdit = (u: UserItem) => {
    setEditingId(u.id)
    setEditValues({ name: u.name, email: u.email, is_active: u.is_active })
    setError(null)
    setTimeout(() => emailRef.current?.focus(), 50)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setError(null)
  }

  const saveEdit = async (userId: number) => {
    setSaving(true)
    setError(null)
    try {
      const resp = (await client.put(`/users/${userId}`, editValues)) as {
        data: ApiResponse<UserItem>
      }
      setUsers((prev) => prev.map((u) => (u.id === userId ? resp.data.data : u)))
      setEditingId(null)
    } catch (err) {
      setError(parseApiError(err, 'Cập nhật thất bại.'))
    } finally {
      setSaving(false)
    }
  }

  const searchActive = nameSearch.trim().length > 0

  const resetCreateForm = () => {
    setCreateForm({
      name: '',
      email: '',
      password: '',
      role: 'field_team',
      is_active: true,
    })
    setCreateError(null)
  }

  const submitCreate = async () => {
    setCreateError(null)
    if (!createForm.name.trim()) {
      setCreateError('Tên là bắt buộc.')
      return
    }
    if (!createForm.email.trim()) {
      setCreateError('Email là bắt buộc.')
      return
    }
    if (createForm.password.length < 8) {
      setCreateError('Mật khẩu tối thiểu 8 ký tự.')
      return
    }
    setCreateSubmitting(true)
    try {
      const resp = (await client.post('/users', {
        name: createForm.name.trim(),
        email: createForm.email.trim(),
        password: createForm.password,
        role: createForm.role,
        is_active: createForm.is_active,
      })) as { data: ApiResponse<UserItem> }
      setUsers((prev) => [resp.data.data, ...prev])
      setTotal((t) => t + 1)
      setCreateOpen(false)
      resetCreateForm()
    } catch (err) {
      setCreateError(parseApiError(err, 'Tạo người dùng thất bại.'))
    } finally {
      setCreateSubmitting(false)
    }
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <AppFormModal
        open={createOpen}
        onClose={() => {
          if (!createSubmitting) {
            setCreateOpen(false)
            resetCreateForm()
          }
        }}
        title="Thêm người dùng"
        subtitle="Nhập mật khẩu đăng nhập cho tài khoản (tối thiểu 8 ký tự)."
        ariaLabelledBy="admin-create-user-title"
        maxWidthClass="max-w-lg"
        footer={
          <>
            <button
              type="button"
              className="rounded-lg border border-[#E2E8F0] bg-white px-4 py-2 text-sm font-medium text-[#64748B] transition hover:bg-[#F8FAFC] disabled:opacity-50"
              disabled={createSubmitting}
              onClick={() => {
                setCreateOpen(false)
                resetCreateForm()
              }}
            >
              Hủy
            </button>
            <button
              type="button"
              className="rounded-lg bg-[#FF7F29] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#E5691D] disabled:opacity-60"
              disabled={createSubmitting}
              onClick={() => void submitCreate()}
            >
              {createSubmitting ? 'Đang tạo...' : 'Tạo tài khoản'}
            </button>
          </>
        }
      >
        {createError ? <p className="mb-3 text-sm text-red-600">{createError}</p> : null}
        <div className="space-y-3">
          <div>
            <label className={appFormLabelClass} htmlFor="create-name">
              Tên
            </label>
            <input
              id="create-name"
              className={appFormInputClass}
              value={createForm.name}
              onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
              autoComplete="name"
            />
          </div>
          <div>
            <label className={appFormLabelClass} htmlFor="create-email">
              Email
            </label>
            <input
              id="create-email"
              type="email"
              className={appFormInputClass}
              value={createForm.email}
              onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
              autoComplete="email"
            />
          </div>
          <div>
            <label className={appFormLabelClass} htmlFor="create-role">
              Vai trò hệ thống
            </label>
            <select
              id="create-role"
              className={appFormInputClass}
              value={createForm.role}
              onChange={(e) =>
                setCreateForm((f) => ({ ...f, role: e.target.value as CreatableRole }))
              }
            >
              {creatableRoles.map((r) => (
                <option key={r} value={r}>
                  {platformUserRoleLabel(r)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={appFormLabelClass} htmlFor="create-pw">
              Mật khẩu
            </label>
            <input
              id="create-pw"
              type="password"
              className={appFormInputClass}
              value={createForm.password}
              onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
              autoComplete="new-password"
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-[#0F172A]">
            <input
              type="checkbox"
              checked={createForm.is_active}
              onChange={(e) => setCreateForm((f) => ({ ...f, is_active: e.target.checked }))}
            />
            Tài khoản hoạt động
          </label>
        </div>
      </AppFormModal>
      <AdminSetPasswordModal
        open={pwResetUser !== null}
        title={pwResetUser ? `Đặt lại mật khẩu — ${pwResetUser.name}` : 'Đặt lại mật khẩu'}
        onClose={() => setPwResetUser(null)}
        onSubmit={async (password, passwordConfirmation) => {
          if (!pwResetUser) return
          try {
            await client.patch(`/users/${pwResetUser.id}/password`, {
              password,
              password_confirmation: passwordConfirmation,
            })
          } catch (err) {
            throw new Error(parseApiError(err, 'Đặt lại mật khẩu thất bại.'))
          }
        }}
      />
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#0F172A]">Quản lý người dùng</h1>
          <p className="text-sm text-[#64748B]">
            {loading
              ? 'Đang tải...'
              : searchActive
                ? `${total} kết quả (lọc theo tên)`
                : `${total} người dùng`}
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => {
              resetCreateForm()
              setCreateOpen(true)
            }}
            className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#FF7F29] bg-[#FF7F29] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#E5691D] sm:shrink-0"
          >
            <UserPlus size={18} strokeWidth={2.25} aria-hidden />
            Thêm người dùng
          </button>
        {!loading ? (
          <div className="relative w-full sm:w-auto sm:min-w-[240px]">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]"
              aria-hidden
            />
            <input
              type="search"
              className={searchInputCls}
              placeholder="Tìm theo tên..."
              value={nameSearch}
              onChange={(e) => setNameSearch(e.target.value)}
              aria-label="Tìm người dùng theo tên"
            />
          </div>
        ) : null}
        </div>
      </div>

      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

      {!loading && (
        <div className="overflow-x-auto rounded-xl border border-[#E2E8F0] bg-card shadow-sm">
          {users.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-[#64748B]">
              {searchActive
                ? `Không có người dùng nào khớp «${nameSearch.trim()}».`
                : 'Chưa có người dùng.'}
            </div>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="bg-[#F8FAFC] text-left">
                <tr>
                  <th className="px-4 py-3 font-medium w-14" aria-hidden />
                  <th className="px-4 py-3 font-medium text-[#0F172A]">Tên</th>
                  <th className="px-4 py-3 font-medium text-[#0F172A]">Email</th>
                  <th className="px-4 py-3 font-medium text-[#0F172A]">Role</th>
                  <th className="px-4 py-3 font-medium text-[#0F172A]">Trạng thái</th>
                  <th className="px-4 py-3 font-medium text-[#0F172A]">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) =>
                  editingId === u.id ? (
                    <tr key={u.id} className="border-t border-[#E2E8F0] bg-[#F8FAFC]/80">
                      <td className="px-3 py-2" />
                      <td className="px-3 py-2">
                        <input
                          className="w-full rounded-lg border border-[#E2E8F0] bg-white px-2 py-1.5 text-sm focus:border-[#FF7F29] focus:outline-none focus:ring-1 focus:ring-[#FF7F29]/30"
                          value={editValues.name}
                          onChange={(e) => setEditValues((v) => ({ ...v, name: e.target.value }))}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          ref={emailRef}
                          type="email"
                          className="w-full rounded-lg border border-[#E2E8F0] bg-white px-2 py-1.5 text-sm focus:border-[#FF7F29] focus:outline-none focus:ring-1 focus:ring-[#FF7F29]/30"
                          value={editValues.email}
                          onChange={(e) => setEditValues((v) => ({ ...v, email: e.target.value }))}
                        />
                      </td>
                      <td className="px-3 py-2 text-[#64748B]">{platformUserRoleLabel(u.role)}</td>
                      <td className="px-3 py-2">
                        <label className="flex cursor-pointer items-center gap-2">
                          <input
                            type="checkbox"
                            checked={editValues.is_active}
                            onChange={(e) =>
                              setEditValues((v) => ({ ...v, is_active: e.target.checked }))
                            }
                          />
                          <span>{editValues.is_active ? 'active' : 'inactive'}</span>
                        </label>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="rounded-lg bg-[#FF7F29] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#E5691D] disabled:opacity-60"
                            disabled={saving}
                            onClick={() => void saveEdit(u.id)}
                          >
                            {saving ? 'Đang lưu...' : 'Lưu'}
                          </button>
                          <button
                            type="button"
                            className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-medium text-[#64748B] transition hover:border-[#FF7F29]/40 hover:text-[#FF7F29]"
                            onClick={cancelEdit}
                          >
                            Hủy
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={u.id} className="border-t border-[#E2E8F0] transition hover:bg-[#F8FAFC]/60">
                      <td className="px-4 py-2">
                        {u.avatar_url ? (
                          <img
                            src={u.avatar_url}
                            alt=""
                            className="h-9 w-9 rounded-full object-cover ring-1 ring-[#E2E8F0]"
                          />
                        ) : (
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FFF3E8] text-xs font-semibold text-[#FF7F29]">
                            {(u.name || '?').slice(0, 1).toUpperCase()}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2 font-medium text-[#0F172A]">{u.name}</td>
                      <td className="px-4 py-2 text-[#64748B]">{u.email}</td>
                      <td className="px-4 py-2 text-[#0F172A]">{platformUserRoleLabel(u.role)}</td>
                      <td className="px-4 py-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            u.is_active
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-red-100 text-red-600'
                          }`}
                        >
                          {u.is_active ? 'active' : 'inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <button type="button" className={btnEditCls} onClick={() => startEdit(u)}>
                            <Pencil size={13} strokeWidth={2.25} aria-hidden />
                            Chỉnh sửa
                          </button>
                          {u.role !== 'admin' ? (
                            <button
                              type="button"
                              className={btnResetPwCls}
                              onClick={() => setPwResetUser(u)}
                            >
                              <KeyRound size={13} strokeWidth={2.25} aria-hidden />
                              Đặt lại MK
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          )}
        </div>
      )}
    </main>
  )
}
