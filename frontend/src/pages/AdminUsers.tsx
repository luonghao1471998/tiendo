import { useEffect, useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'

import client from '@/api/client'
import useAuthStore from '@/stores/authStore'

type UserItem = {
  id: number
  name: string
  email: string
  role: 'admin' | 'project_manager' | 'field_team' | 'viewer' | null
  is_active: boolean
  created_at: string | null
}

type ApiListResponse<T> = {
  success: boolean
  data: T[]
  meta?: { current_page: number; per_page: number; total: number }
}

type ApiResponse<T> = { success: boolean; data: T }

function parseApiError(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const data = (error as { response?: { data?: { error?: { message?: unknown } } } }).response
      ?.data?.error?.message
    if (typeof data === 'string' && data) return data
  }
  return fallback
}

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
  const emailRef = useRef<HTMLInputElement>(null)

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const resp = (await client.get('/users')) as { data: ApiListResponse<UserItem> }
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
  }, [user?.role])

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

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Quản lý người dùng</h1>
          <p className="text-sm text-muted-foreground">
            {loading ? 'Đang tải...' : `${total} người dùng`}
          </p>
        </div>
      </div>

      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

      {!loading && (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Tên</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Trạng thái</th>
                <th className="px-4 py-3 font-medium">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) =>
                editingId === u.id ? (
                  <tr key={u.id} className="border-t bg-muted/20">
                    <td className="px-3 py-2">
                      <input
                        className="w-full rounded-md border bg-background px-2 py-1 text-sm"
                        value={editValues.name}
                        onChange={(e) => setEditValues((v) => ({ ...v, name: e.target.value }))}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        ref={emailRef}
                        type="email"
                        className="w-full rounded-md border bg-background px-2 py-1 text-sm"
                        value={editValues.email}
                        onChange={(e) => setEditValues((v) => ({ ...v, email: e.target.value }))}
                      />
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{u.role ?? '—'}</td>
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
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="rounded-md bg-primary px-3 py-1 text-xs text-primary-foreground disabled:opacity-60"
                          disabled={saving}
                          onClick={() => void saveEdit(u.id)}
                        >
                          {saving ? 'Đang lưu...' : 'Lưu'}
                        </button>
                        <button
                          type="button"
                          className="rounded-md border px-3 py-1 text-xs"
                          onClick={cancelEdit}
                        >
                          Hủy
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={u.id} className="border-t hover:bg-muted/20">
                    <td className="px-4 py-2 font-medium">{u.name}</td>
                    <td className="px-4 py-2 text-muted-foreground">{u.email}</td>
                    <td className="px-4 py-2">{u.role ?? '—'}</td>
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
                      <button
                        type="button"
                        className="text-sm text-primary hover:underline"
                        onClick={() => startEdit(u)}
                      >
                        Chỉnh sửa
                      </button>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}
