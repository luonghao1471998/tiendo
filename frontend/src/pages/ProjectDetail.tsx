import { useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'

import client from '@/api/client'
import useAuthStore from '@/stores/authStore'

// ─── Types ──────────────────────────────────────────────────────────────────

type ProjectStats = {
  total_zones: number
  done_zones: number
  in_progress_zones: number
  delayed_zones: number
  not_started_zones: number
  paused_zones: number
  completion_pct: number
}

type ProjectData = {
  id: number
  name: string
  code: string
  description: string | null
  address: string | null
  stats?: ProjectStats
}

type ApiResponse<T> = { success: boolean; data: T }

type MasterLayerItem = {
  id: number
  name: string
  code: string
  sort_order: number
}

type LayerItem = {
  id: number
  master_layer_id: number
  name: string
  code: string
  type: string
  status: 'uploading' | 'processing' | 'ready' | 'failed'
  zones_count: number
  error_message?: string | null
}

type MemberItem = {
  id: number
  role: 'project_manager' | 'field_team' | 'viewer'
  user: {
    id: number
    name: string
    email: string
    is_active: boolean
  } | null
}

type InviteMemberPayload = {
  email: string
  name?: string
  role: 'project_manager' | 'field_team' | 'viewer'
}

type InviteMemberResponse = {
  member: MemberItem
  temporary_password?: string
}

type TabKey = 'layers' | 'members' | 'settings'

const LAYER_TYPE_LABELS: Record<string, string> = {
  architecture: 'Kiến trúc',
  electrical: 'Hệ điện',
  mechanical: 'Cơ khí',
  plumbing: 'Hệ nước',
  other: 'Khác',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseApiError(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const msg = (error as { response?: { data?: { error?: { message?: unknown } } } }).response
      ?.data?.error?.message
    if (typeof msg === 'string' && msg) return msg
  }
  return fallback
}

function resolveProjectRole(
  user: {
    role: 'admin' | 'project_manager' | 'field_team' | 'viewer' | null
    projects: Array<{ id: number; role: 'project_manager' | 'field_team' | 'viewer' }>
  } | null,
  projectId: number | null,
): 'admin' | 'project_manager' | 'field_team' | 'viewer' | null {
  if (!user) return null
  if (user.role === 'admin') return 'admin'
  if (!projectId) return null
  return user.projects.find((p) => p.id === projectId)?.role ?? null
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border bg-background px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  )
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      className={`rounded-md px-3 py-2 text-sm transition ${
        active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      }`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  )
}

function StatusBadge({ status }: { status: LayerItem['status'] }) {
  const palette: Record<LayerItem['status'], string> = {
    uploading: 'bg-amber-100 text-amber-700 border-amber-300',
    processing: 'bg-blue-100 text-blue-700 border-blue-300',
    ready: 'bg-emerald-100 text-emerald-700 border-emerald-300',
    failed: 'bg-red-100 text-red-700 border-red-300',
  }
  const labels: Record<LayerItem['status'], string> = {
    uploading: 'Đang upload',
    processing: 'Đang xử lý',
    ready: 'Sẵn sàng',
    failed: 'Lỗi',
  }
  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${palette[status]}`}>
      {labels[status]}
    </span>
  )
}

// ─── Create MasterLayer form (inline) ──────────────────────────────────────

function CreateMasterLayerForm({
  onSave,
  onCancel,
  loading,
}: {
  onSave: (name: string, code: string, sortOrder: number) => Promise<void>
  onCancel: () => void
  loading: boolean
}) {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [sortOrder, setSortOrder] = useState(0)
  const [err, setErr] = useState<string | null>(null)

  const submit = async () => {
    if (!name.trim() || !code.trim()) { setErr('Tên và mã là bắt buộc.'); return }
    setErr(null)
    try {
      await onSave(name.trim(), code.trim().toUpperCase(), sortOrder)
    } catch (e) {
      setErr(parseApiError(e, 'Tạo thất bại.'))
    }
  }

  return (
    <div className="rounded-lg border border-dashed bg-muted/20 p-4">
      <p className="mb-3 text-sm font-semibold">Thêm mặt bằng mới</p>
      <div className="grid gap-2 sm:grid-cols-3">
        <input
          className="rounded-md border bg-background px-3 py-2 text-sm"
          placeholder="Tên (VD: Tầng 1)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="rounded-md border bg-background px-3 py-2 text-sm uppercase"
          placeholder="Mã (VD: T1)"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <input
          type="number"
          className="rounded-md border bg-background px-3 py-2 text-sm"
          placeholder="Thứ tự (0, 1, 2...)"
          value={sortOrder}
          onChange={(e) => setSortOrder(Number(e.target.value))}
        />
      </div>
      {err ? <p className="mt-2 text-xs text-red-600">{err}</p> : null}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => void submit()}
          disabled={loading}
          className="rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-60"
        >
          {loading ? 'Đang tạo...' : 'Tạo'}
        </button>
        <button type="button" onClick={onCancel} className="rounded-md border px-4 py-1.5 text-sm">
          Hủy
        </button>
      </div>
    </div>
  )
}

// ─── Upload Layer form (inline, PDF upload) ─────────────────────────────────

function UploadLayerForm({
  masterLayerId,
  onSave,
  onCancel,
  loading,
}: {
  masterLayerId: number
  onSave: (mlId: number, formData: FormData) => Promise<void>
  onCancel: () => void
  loading: boolean
}) {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [type, setType] = useState('architecture')
  const [file, setFile] = useState<File | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const submit = async () => {
    if (!name.trim() || !code.trim()) { setErr('Tên và mã là bắt buộc.'); return }
    if (!file) { setErr('Vui lòng chọn file PDF.'); return }
    if (file.type !== 'application/pdf') { setErr('Chỉ chấp nhận file PDF.'); return }
    if (file.size > 50 * 1024 * 1024) { setErr('File tối đa 50MB.'); return }

    setErr(null)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('name', name.trim())
    fd.append('code', code.trim().toUpperCase())
    fd.append('type', type)

    try {
      await onSave(masterLayerId, fd)
    } catch (e) {
      setErr(parseApiError(e, 'Upload thất bại.'))
    }
  }

  return (
    <div className="rounded-lg border border-dashed bg-muted/20 p-4">
      <p className="mb-3 text-sm font-semibold">Thêm bản vẽ (upload PDF)</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          className="rounded-md border bg-background px-3 py-2 text-sm"
          placeholder="Tên bản vẽ (VD: Kiến trúc)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="rounded-md border bg-background px-3 py-2 text-sm uppercase"
          placeholder="Mã (VD: KT)"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <select
          className="rounded-md border bg-background px-3 py-2 text-sm"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          {Object.entries(LAYER_TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <div>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="w-full rounded-md border bg-background px-3 py-2 text-left text-sm hover:bg-muted"
          >
            {file ? (
              <span className="text-foreground">{file.name}</span>
            ) : (
              <span className="text-muted-foreground">Chọn file PDF (≤ 50MB)...</span>
            )}
          </button>
        </div>
      </div>
      {err ? <p className="mt-2 text-xs text-red-600">{err}</p> : null}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => void submit()}
          disabled={loading || !file}
          className="rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-60"
        >
          {loading ? 'Đang upload...' : 'Upload bản vẽ'}
        </button>
        <button type="button" onClick={onCancel} className="rounded-md border px-4 py-1.5 text-sm">
          Hủy
        </button>
      </div>
    </div>
  )
}

// ─── LayersTab ─────────────────────────────────────────────────────────────

function LayersTab({
  projectId,
  projectRole,
  masterLayers,
  selectedMasterLayerId,
  onSelectMasterLayer,
  layers,
  layersLoading,
  mlActionLoading,
  layerActionLoading,
  onCreateMasterLayer,
  onDeleteMasterLayer,
  onCreateLayer,
  onDeleteLayer,
  onRetryLayer,
}: {
  projectId: number
  projectRole: 'admin' | 'project_manager' | 'field_team' | 'viewer' | null
  masterLayers: MasterLayerItem[]
  selectedMasterLayerId: number | null
  onSelectMasterLayer: (id: number | null) => void
  layers: LayerItem[]
  layersLoading: boolean
  mlActionLoading: boolean
  layerActionLoading: boolean
  onCreateMasterLayer: (name: string, code: string, sortOrder: number) => Promise<void>
  onDeleteMasterLayer: (id: number) => Promise<void>
  onCreateLayer: (mlId: number, fd: FormData) => Promise<void>
  onDeleteLayer: (id: number) => Promise<void>
  onRetryLayer: (id: number) => Promise<void>
}) {
  const canManage = projectRole === 'admin' || projectRole === 'project_manager'
  const [showCreateML, setShowCreateML] = useState(false)
  const [showUploadLayer, setShowUploadLayer] = useState(false)

  const handleCreateML = async (name: string, code: string, sortOrder: number) => {
    await onCreateMasterLayer(name, code, sortOrder)
    setShowCreateML(false)
  }

  const handleCreateLayer = async (mlId: number, fd: FormData) => {
    await onCreateLayer(mlId, fd)
    setShowUploadLayer(false)
  }

  return (
    <div className="space-y-4">
      {/* MasterLayer header */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Mặt bằng</h3>
        {canManage && !showCreateML ? (
          <button
            type="button"
            onClick={() => setShowCreateML(true)}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
          >
            + Thêm mặt bằng
          </button>
        ) : null}
      </div>

      {/* Create MasterLayer form */}
      {showCreateML ? (
        <CreateMasterLayerForm
          onSave={handleCreateML}
          onCancel={() => setShowCreateML(false)}
          loading={mlActionLoading}
        />
      ) : null}

      {masterLayers.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Chưa có mặt bằng nào.{canManage ? ' Nhấn "+ Thêm mặt bằng" để bắt đầu.' : ''}
        </div>
      ) : (
        <div className="space-y-4">
          {/* MasterLayer selector */}
          <div className="flex items-center gap-2 rounded-lg border p-3">
            <label className="shrink-0 text-sm font-medium text-muted-foreground">Mặt bằng:</label>
            <select
              className="flex-1 rounded-md border bg-background px-3 py-1.5 text-sm"
              value={selectedMasterLayerId ?? ''}
              onChange={(e) => onSelectMasterLayer(e.target.value ? Number(e.target.value) : null)}
            >
              {masterLayers.map((ml) => (
                <option key={ml.id} value={ml.id}>
                  {ml.name} ({ml.code})
                </option>
              ))}
            </select>
            {canManage && selectedMasterLayerId ? (
              <button
                type="button"
                className="shrink-0 rounded-md border border-red-200 px-2 py-1.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                disabled={mlActionLoading}
                onClick={() => void onDeleteMasterLayer(selectedMasterLayerId)}
              >
                Xóa mặt bằng này
              </button>
            ) : null}
          </div>

          {/* Layer list */}
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">
              Bản vẽ trong mặt bằng này
            </p>
            {canManage && selectedMasterLayerId && !showUploadLayer ? (
              <button
                type="button"
                onClick={() => setShowUploadLayer(true)}
                className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
              >
                + Thêm bản vẽ
              </button>
            ) : null}
          </div>

          {/* Upload Layer form */}
          {showUploadLayer && selectedMasterLayerId ? (
            <UploadLayerForm
              masterLayerId={selectedMasterLayerId}
              onSave={handleCreateLayer}
              onCancel={() => setShowUploadLayer(false)}
              loading={layerActionLoading}
            />
          ) : null}

          {layersLoading ? (
            <p className="text-sm text-muted-foreground">Đang tải bản vẽ...</p>
          ) : null}

          {!layersLoading && layers.length === 0 ? (
            <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
              Mặt bằng này chưa có bản vẽ nào.
            </div>
          ) : null}

          {!layersLoading &&
            layers.map((layer) => (
              <div key={layer.id} className="rounded-lg border p-4">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{layer.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {layer.code} ·{' '}
                      <span className="rounded bg-muted px-1.5 py-0.5">
                        {LAYER_TYPE_LABELS[layer.type] ?? layer.type}
                      </span>
                    </p>
                    {layer.error_message ? (
                      <p className="mt-1 text-xs text-red-600">{layer.error_message}</p>
                    ) : null}
                    {layer.status === 'processing' || layer.status === 'uploading' ? (
                      <p className="mt-1 flex items-center gap-1 text-xs text-blue-600">
                        <span className="inline-block h-2 w-2 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
                        Đang xử lý bản vẽ...
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <StatusBadge status={layer.status} />
                    <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
                      {layer.zones_count} khu vực
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {/* Canvas links — only if ready */}
                  {layer.status === 'ready' ? (
                    <>
                      {projectRole === 'admin' || projectRole === 'project_manager' ? (
                        <Link
                          to={`/projects/${projectId}/layers/${layer.id}/editor`}
                          className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90"
                        >
                          Mở Editor
                        </Link>
                      ) : null}
                      {projectRole === 'field_team' ? (
                        <Link
                          to={`/projects/${projectId}/layers/${layer.id}/progress`}
                          className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90"
                        >
                          Mở Progress
                        </Link>
                      ) : null}
                      <Link
                        to={`/projects/${projectId}/layers/${layer.id}/view`}
                        className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
                      >
                        Xem
                      </Link>
                    </>
                  ) : null}

                  {/* Retry for failed */}
                  {layer.status === 'failed' && canManage ? (
                    <button
                      type="button"
                      onClick={() => void onRetryLayer(layer.id)}
                      disabled={layerActionLoading}
                      className="rounded-md border border-amber-300 px-3 py-1.5 text-sm text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                    >
                      Thử lại
                    </button>
                  ) : null}

                  {/* Delete */}
                  {canManage ? (
                    <button
                      type="button"
                      onClick={() => void onDeleteLayer(layer.id)}
                      disabled={layerActionLoading}
                      className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      Xóa
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}

// ─── MembersTab ───────────────────────────────────────────────────────────────

function MembersTab({
  members,
  projectRole,
  loading,
  actionLoading,
  error,
  temporaryPassword,
  onDismissTemporaryPassword,
  onInvite,
  onRemove,
  currentUserId,
}: {
  members: MemberItem[]
  projectRole: 'admin' | 'project_manager' | 'field_team' | 'viewer' | null
  loading: boolean
  actionLoading: boolean
  error: string | null
  temporaryPassword: string | null
  onDismissTemporaryPassword: () => void
  onInvite: (payload: InviteMemberPayload) => Promise<void>
  onRemove: (userId: number) => Promise<void>
  currentUserId: number | null
}) {
  const canManageMembers = projectRole === 'admin' || projectRole === 'project_manager'
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<'project_manager' | 'field_team' | 'viewer'>('field_team')

  const submitInvite = async () => {
    if (!email.trim()) return
    await onInvite({ email: email.trim(), name: name.trim() || undefined, role })
    setEmail('')
    setName('')
    if (projectRole !== 'admin') setRole('field_team')
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold">Thành viên dự án</h3>
        <span className="text-xs text-muted-foreground">{members.length} thành viên</span>
      </div>

      {canManageMembers ? (
        <div className="mb-4 rounded-lg border p-4">
          <h4 className="mb-3 text-sm font-semibold">Mời thành viên</h4>
          <div className="grid gap-2 md:grid-cols-4">
            <input
              className="rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              className="rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="Tên (nếu email chưa tồn tại)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <select
              className="rounded-md border bg-background px-3 py-2 text-sm"
              value={role}
              onChange={(e) => setRole(e.target.value as typeof role)}
            >
              <option value="field_team">field_team</option>
              <option value="viewer">viewer</option>
              {projectRole === 'admin' ? <option value="project_manager">project_manager</option> : null}
            </select>
            <button
              type="button"
              className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-60"
              onClick={() => void submitInvite()}
              disabled={actionLoading || !email.trim()}
            >
              {actionLoading ? 'Đang mời...' : 'Mời thành viên'}
            </button>
          </div>
        </div>
      ) : null}

      {temporaryPassword ? (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-4">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-sm font-semibold text-amber-800">Mật khẩu tạm (chỉ hiển thị 1 lần)</p>
            <button type="button" className="text-xs text-amber-700 underline" onClick={onDismissTemporaryPassword}>
              Đã ghi nhận
            </button>
          </div>
          <p className="font-mono text-sm text-amber-900">{temporaryPassword}</p>
        </div>
      ) : null}

      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
      {loading ? <p className="mb-3 text-sm text-muted-foreground">Đang tải...</p> : null}

      {members.length === 0 ? (
        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          Chưa có thành viên.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Tên</th>
                <th className="px-3 py-2 font-medium">Email</th>
                <th className="px-3 py-2 font-medium">Role</th>
                <th className="px-3 py-2 font-medium">Trạng thái</th>
                <th className="px-3 py-2 font-medium">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => {
                const memberUserId = member.user?.id ?? null
                const canRemove = canManageMembers && memberUserId !== null && memberUserId !== currentUserId
                return (
                  <tr key={member.id} className="border-t">
                    <td className="px-3 py-2">{member.user?.name ?? '—'}</td>
                    <td className="px-3 py-2">{member.user?.email ?? '—'}</td>
                    <td className="px-3 py-2">{member.role}</td>
                    <td className="px-3 py-2">
                      {member.user?.is_active === false ? (
                        <span className="text-red-600">inactive</span>
                      ) : (
                        <span className="text-emerald-600">active</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {canRemove ? (
                        <button
                          type="button"
                          className="text-sm text-red-600 hover:underline disabled:opacity-50"
                          onClick={() => void onRemove(memberUserId)}
                          disabled={actionLoading}
                        >
                          Gỡ khỏi project
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── SettingsTab ───────────────────────────────────────────────────────────────

function SettingsTab({ projectId }: { projectId: number }) {
  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold">Cài đặt dự án</h3>
      <p className="text-sm text-muted-foreground">
        Export toàn bộ dự án ra Excel hoặc quản lý share link.
      </p>
      <a
        href={`${(import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api/v1'}/projects/${projectId}/export/excel`}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted"
      >
        ⬇ Export Excel toàn dự án
      </a>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function ProjectDetail() {
  const { id } = useParams()
  const { user } = useAuthStore()
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const activeTab: TabKey = tabParam === 'members' || tabParam === 'settings' ? tabParam : 'layers'

  // Project data
  const [project, setProject] = useState<ProjectData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // MasterLayers
  const [masterLayers, setMasterLayers] = useState<MasterLayerItem[]>([])
  const [selectedMasterLayerId, setSelectedMasterLayerId] = useState<number | null>(null)
  const [mlActionLoading, setMlActionLoading] = useState(false)

  // Layers
  const [layers, setLayers] = useState<LayerItem[]>([])
  const [layersLoading, setLayersLoading] = useState(false)
  const [layerActionLoading, setLayerActionLoading] = useState(false)

  // Members
  const [members, setMembers] = useState<MemberItem[]>([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [memberActionLoading, setMemberActionLoading] = useState(false)
  const [memberError, setMemberError] = useState<string | null>(null)
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null)

  // Polling ref for processing layers
  const processingLayerIdsRef = useRef<Set<number>>(new Set())

  // ── Load project + masterLayers + members ──────────────────────────────

  useEffect(() => {
    const projectId = id?.trim()
    if (!projectId) { setError('Thiếu project id.'); setLoading(false); return }

    const fetch = async () => {
      try {
        setLoading(true)
        const [projResp, mlResp, memberResp] = await Promise.all([
          client.get(`/projects/${projectId}`) as Promise<{ data: ApiResponse<ProjectData> }>,
          client.get(`/projects/${projectId}/master-layers`) as Promise<{ data: ApiResponse<MasterLayerItem[]> }>,
          client.get(`/projects/${projectId}/members`) as Promise<{ data: ApiResponse<MemberItem[]> }>,
        ])
        setProject(projResp.data.data)
        const mls = mlResp.data.data
        setMasterLayers(mls)
        setSelectedMasterLayerId(mls[0]?.id ?? null)
        setMembers(memberResp.data.data)
      } catch {
        setError('Không tải được chi tiết dự án.')
      } finally {
        setLoading(false)
      }
    }
    void fetch()
  }, [id])

  // ── Load layers when selectedMasterLayerId changes ─────────────────────

  useEffect(() => {
    if (!selectedMasterLayerId) { setLayers([]); return }
    const fetch = async () => {
      setLayersLoading(true)
      try {
        const resp = (await client.get(`/master-layers/${selectedMasterLayerId}/layers`)) as {
          data: ApiResponse<LayerItem[]>
        }
        setLayers(resp.data.data)
      } catch {
        setLayers([])
      } finally {
        setLayersLoading(false)
      }
    }
    void fetch()
  }, [selectedMasterLayerId])

  // ── Polling: keep track of processing layers ──────────────────────────

  useEffect(() => {
    processingLayerIdsRef.current = new Set(
      layers.filter((l) => l.status === 'processing' || l.status === 'uploading').map((l) => l.id),
    )
  }, [layers])

  useEffect(() => {
    const interval = setInterval(async () => {
      if (processingLayerIdsRef.current.size === 0) return
      for (const layerId of processingLayerIdsRef.current) {
        try {
          const resp = (await client.get(`/layers/${layerId}`)) as { data: ApiResponse<LayerItem> }
          const updated = resp.data.data
          setLayers((prev) =>
            prev.map((l) =>
              l.id === layerId
                ? { ...l, status: updated.status, error_message: updated.error_message ?? null }
                : l,
            ),
          )
        } catch {
          // silent fail — will retry next interval
        }
      }
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  // ── MasterLayer actions ────────────────────────────────────────────────

  const createMasterLayer = async (name: string, code: string, sortOrder: number) => {
    const projectId = id?.trim()
    if (!projectId) return
    setMlActionLoading(true)
    try {
      const resp = (await client.post(`/projects/${projectId}/master-layers`, {
        name,
        code,
        sort_order: sortOrder,
      })) as { data: ApiResponse<MasterLayerItem> }
      const newMl = resp.data.data
      setMasterLayers((prev) => [...prev, newMl].sort((a, b) => a.sort_order - b.sort_order))
      setSelectedMasterLayerId(newMl.id)
    } finally {
      setMlActionLoading(false)
    }
  }

  const deleteMasterLayer = async (mlId: number) => {
    if (!confirm('Xóa mặt bằng này? Tất cả bản vẽ và khu vực bên trong sẽ bị xóa vĩnh viễn.')) return
    setMlActionLoading(true)
    try {
      await client.delete(`/master-layers/${mlId}`)
      const remaining = masterLayers.filter((ml) => ml.id !== mlId)
      setMasterLayers(remaining)
      setSelectedMasterLayerId(remaining[0]?.id ?? null)
    } finally {
      setMlActionLoading(false)
    }
  }

  // ── Layer actions ──────────────────────────────────────────────────────

  const createLayer = async (mlId: number, formData: FormData) => {
    setLayerActionLoading(true)
    try {
      const resp = (await client.post(`/master-layers/${mlId}/layers`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })) as { data: ApiResponse<LayerItem> }
      setLayers((prev) => [...prev, resp.data.data])
    } finally {
      setLayerActionLoading(false)
    }
  }

  const deleteLayer = async (layerId: number) => {
    if (!confirm('Xóa bản vẽ này? Tất cả khu vực và vùng tô sẽ bị xóa vĩnh viễn.')) return
    setLayerActionLoading(true)
    try {
      await client.delete(`/layers/${layerId}`)
      setLayers((prev) => prev.filter((l) => l.id !== layerId))
    } finally {
      setLayerActionLoading(false)
    }
  }

  const retryLayer = async (layerId: number) => {
    setLayerActionLoading(true)
    try {
      await client.post(`/layers/${layerId}/retry`)
      setLayers((prev) =>
        prev.map((l) =>
          l.id === layerId ? { ...l, status: 'processing', error_message: null } : l,
        ),
      )
    } finally {
      setLayerActionLoading(false)
    }
  }

  // ── Member actions ─────────────────────────────────────────────────────

  const fetchMembers = async (projectId: string) => {
    setMembersLoading(true)
    try {
      const resp = (await client.get(`/projects/${projectId}/members`)) as {
        data: ApiResponse<MemberItem[]>
      }
      setMembers(resp.data.data)
    } finally {
      setMembersLoading(false)
    }
  }

  const inviteMember = async (payload: InviteMemberPayload) => {
    const projectId = id?.trim()
    if (!projectId) return
    setMemberError(null)
    setTemporaryPassword(null)
    setMemberActionLoading(true)
    try {
      const resp = (await client.post(`/projects/${projectId}/members/invite`, payload)) as {
        data: ApiResponse<InviteMemberResponse>
      }
      if (resp.data.data.temporary_password) {
        setTemporaryPassword(resp.data.data.temporary_password)
      }
      await fetchMembers(projectId)
    } catch (err) {
      setMemberError(parseApiError(err, 'Mời thành viên thất bại.'))
      throw err
    } finally {
      setMemberActionLoading(false)
    }
  }

  const removeMember = async (userId: number) => {
    const projectId = id?.trim()
    if (!projectId) return
    setMemberError(null)
    setMemberActionLoading(true)
    try {
      await client.delete(`/projects/${projectId}/members/${userId}`)
      await fetchMembers(projectId)
    } catch (err) {
      setMemberError(parseApiError(err, 'Xóa thành viên thất bại.'))
      throw err
    } finally {
      setMemberActionLoading(false)
    }
  }

  const projectRole = resolveProjectRole(user, project?.id ?? null)

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-8">
      <div className="mb-6">
        <Link to="/projects" className="text-sm text-muted-foreground hover:underline">
          ← Quay lại danh sách dự án
        </Link>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Đang tải dữ liệu...</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {!loading && !error && project ? (
        <section className="space-y-6 rounded-xl border bg-card p-6">
          {/* Project header */}
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{project.code}</p>
            <h1 className="mt-1 text-2xl font-semibold">{project.name}</h1>
            {project.description ? (
              <p className="mt-1 text-sm text-muted-foreground">{project.description}</p>
            ) : null}
            {project.address ? (
              <p className="mt-0.5 text-sm text-muted-foreground">📍 {project.address}</p>
            ) : null}
          </div>

          {/* Stats */}
          {project.stats ? (
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <Stat label="Tổng zone" value={project.stats.total_zones} />
              <Stat label="Hoàn thành" value={project.stats.done_zones} />
              <Stat label="Đang thi công" value={project.stats.in_progress_zones} />
              <Stat label="Trì hoãn" value={project.stats.delayed_zones} />
              <Stat label="Tạm dừng" value={project.stats.paused_zones} />
              <Stat label="Tiến độ" value={`${project.stats.completion_pct}%`} />
            </div>
          ) : null}

          {/* Tabs */}
          <div className="border-t pt-5">
            <div className="mb-4 flex flex-wrap gap-2 border-b pb-3">
              <TabButton active={activeTab === 'layers'} onClick={() => setSearchParams({ tab: 'layers' })} label="Mặt bằng" />
              <TabButton active={activeTab === 'members'} onClick={() => setSearchParams({ tab: 'members' })} label="Thành viên" />
              <TabButton active={activeTab === 'settings'} onClick={() => setSearchParams({ tab: 'settings' })} label="Cài đặt" />
            </div>

            {activeTab === 'layers' ? (
              <LayersTab
                projectId={project.id}
                projectRole={projectRole}
                masterLayers={masterLayers}
                selectedMasterLayerId={selectedMasterLayerId}
                onSelectMasterLayer={setSelectedMasterLayerId}
                layers={layers}
                layersLoading={layersLoading}
                mlActionLoading={mlActionLoading}
                layerActionLoading={layerActionLoading}
                onCreateMasterLayer={createMasterLayer}
                onDeleteMasterLayer={deleteMasterLayer}
                onCreateLayer={createLayer}
                onDeleteLayer={deleteLayer}
                onRetryLayer={retryLayer}
              />
            ) : null}

            {activeTab === 'members' ? (
              <MembersTab
                members={members}
                projectRole={projectRole}
                loading={membersLoading}
                actionLoading={memberActionLoading}
                error={memberError}
                temporaryPassword={temporaryPassword}
                onDismissTemporaryPassword={() => setTemporaryPassword(null)}
                onInvite={inviteMember}
                onRemove={removeMember}
                currentUserId={user?.id ?? null}
              />
            ) : null}

            {activeTab === 'settings' ? <SettingsTab projectId={project.id} /> : null}
          </div>
        </section>
      ) : null}
    </main>
  )
}
