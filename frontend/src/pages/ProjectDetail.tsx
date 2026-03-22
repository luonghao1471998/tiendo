import { useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle, Building2, CheckCircle2, ChevronLeft,
  HardHat, Layers, MapPin, PauseCircle, TrendingUp,
} from 'lucide-react'

import client from '@/api/client'
import { parseApiError } from '@/lib/parseApiError'
import useAuthStore from '@/stores/authStore'
import useCanvasStore from '@/stores/canvasStore'

// ─── Types ──────────────────────────────────────────────────────────────────

type ProjectStats = {
  total_zones: number
  not_started: number
  in_progress: number
  completed: number
  delayed: number
  paused: number
  progress_pct: number
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

type StatItem = {
  label: string
  value: number | string
  icon: React.ReactNode
  highlight?: boolean
}

function Stat({ label, value, icon, highlight }: StatItem) {
  return (
    <div className={`flex flex-col gap-2 rounded-2xl border p-4 transition-all ${
      highlight
        ? 'border-[#FF7F29]/30 bg-[#FFF3E8]'
        : 'border-[#E2E8F0] bg-[#F8FAFC]'
    }`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-[#64748B]">{label}</p>
        <span className={highlight ? 'text-[#FF7F29]' : 'text-[#94A3B8]'}>{icon}</span>
      </div>
      <p className={`text-2xl font-bold leading-none ${highlight ? 'text-[#FF7F29]' : 'text-[#0F172A]'}`}>
        {value}
      </p>
    </div>
  )
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      className={`cursor-pointer border-b-2 px-4 py-2.5 text-sm font-medium transition-all duration-150 ${
        active
          ? 'border-[#FF7F29] text-[#FF7F29]'
          : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
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
          placeholder="Thứ tự hiển thị (0=đầu tiên)"
          title="Thứ tự hiển thị trong danh sách. 0 = hiển thị đầu tiên, 1 = thứ hai, ..."
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
  const [importingLayerId, setImportingLayerId] = useState<number | null>(null)

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
              <div key={layer.id} className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-4">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-[#0F172A]">{layer.name}</p>
                    <p className="mt-0.5 text-xs text-[#64748B]">
                      {layer.code} ·{' '}
                      <span className="rounded bg-white px-1.5 py-0.5 border border-[#E2E8F0]">
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

                  {/* Import Excel — only ready layers, PM/admin */}
                  {layer.status === 'ready' && canManage ? (
                    <button
                      type="button"
                      onClick={() => setImportingLayerId(layer.id)}
                      className="rounded-md border border-emerald-300 px-3 py-1.5 text-sm text-emerald-700 hover:bg-emerald-50"
                    >
                      ⬆ Nhập Excel
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

          {/* Excel Import Modal */}
          {importingLayerId ? (
            <ExcelImportModal
              layerId={importingLayerId}
              layerName={layers.find((l) => l.id === importingLayerId)?.name ?? `Layer #${importingLayerId}`}
              onClose={() => setImportingLayerId(null)}
            />
          ) : null}
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

// ─── ExcelImportModal ──────────────────────────────────────────────────────────

/** Khớp `preview_data` từ API ExcelImportService */
type PreviewRow = {
  row: number
  zone_code: string
  found: boolean
  match_type?: string | null
  current_status?: string | null
  new_status?: string | null
  current_completion_pct?: number | null
  new_completion_pct?: number | null
  current_assignee?: string | null
  new_assignee?: string | null
  new_deadline?: string | null
  new_notes?: string | null
}

type ExcelImportResult = {
  id: number
  status: string
  preview_data: PreviewRow[] | null
}

type ApplyResult = {
  success_count: number
  not_found_count: number
  errors: string[]
}

const STATUS_VI: Record<string, string> = {
  not_started: 'Chưa bắt đầu',
  in_progress: 'Đang thi công',
  completed: 'Hoàn thành',
  delayed: 'Trễ',
  paused: 'Tạm dừng',
}

function ExcelImportModal({
  layerId,
  layerName,
  onClose,
}: {
  layerId: number
  layerName: string
  onClose: () => void
}) {
  type Stage = 'upload' | 'preview' | 'applied'
  const [stage, setStage] = useState<Stage>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [importJob, setImportJob] = useState<ExcelImportResult | null>(null)
  const [applyResult, setApplyResult] = useState<ApplyResult | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const { fetchZonesAndMarks } = useCanvasStore()

  const upload = async () => {
    if (!file) return
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      setErr('Chỉ chấp nhận file .xlsx hoặc .xls.')
      return
    }
    setUploading(true); setErr(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const resp = (await client.post(`/layers/${layerId}/import`, fd)) as {
        data: ApiResponse<ExcelImportResult>
      }
      setImportJob(resp.data.data)
      setStage('preview')
    } catch (e) {
      setErr(parseApiError(e, 'Upload thất bại.'))
    } finally {
      setUploading(false)
    }
  }

  const apply = async () => {
    if (!importJob) return
    setApplying(true); setErr(null)
    try {
      const resp = (await client.post(`/excel-imports/${importJob.id}/apply`)) as {
        data: ApiResponse<ApplyResult>
      }
      setApplyResult(resp.data.data)
      setStage('applied')
    } catch (e) {
      setErr(parseApiError(e, 'Áp dụng thất bại.'))
    } finally {
      setApplying(false)
    }
  }

  const preview = importJob?.preview_data ?? []
  const foundRows = preview.filter((r) => r.found)
  const notFoundRows = preview.filter((r) => !r.found)

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#0F172A]/55 p-4 backdrop-blur-sm"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_25px_50px_-12px_rgba(15,23,42,0.35)]"
        style={{ maxHeight: '90vh' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="excel-import-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-[#E2E8F0] bg-[#F8FAFC] px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 border-l-4 border-[#FF7F29] pl-3">
              <h2 id="excel-import-modal-title" className="text-lg font-semibold text-[#0F172A]">
                Nhập Excel
              </h2>
              <p className="mt-0.5 truncate text-xs text-[#64748B]">{layerName}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-md p-1.5 text-[#64748B] hover:bg-[#E2E8F0]/80"
              aria-label="Đóng"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Steps indicator */}
        <div className="flex border-b border-[#E2E8F0] bg-white text-xs">
          {(['upload', 'preview', 'applied'] as Stage[]).map((s, i) => (
            <div
              key={s}
              className={`flex-1 py-2.5 text-center font-medium ${
                stage === s
                  ? 'border-b-2 border-[#FF7F29] text-[#0F172A]'
                  : 'text-[#64748B]'
              }`}
            >
              {i + 1}. {s === 'upload' ? 'Chọn file' : s === 'preview' ? 'Xem trước' : 'Hoàn tất'}
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto bg-white p-5 text-[#0F172A]">

          {/* ── Stage 1: Upload ── */}
          {stage === 'upload' ? (
            <div className="space-y-4">
              <div className="rounded-xl border-2 border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-6 text-center">
                <p className="mb-3 text-sm font-medium text-[#0F172A]">Chọn file Excel (.xlsx)</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => { setFile(e.target.files?.[0] ?? null); setErr(null) }}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="rounded-lg border border-[#E2E8F0] bg-white px-4 py-2 text-sm font-medium text-[#0F172A] shadow-sm transition hover:border-[#FF7F29]/70 hover:text-[#FF7F29]"
                >
                  📂 Chọn file
                </button>
                {file ? (
                  <p className="mt-2 text-sm font-medium text-emerald-600">✓ {file.name}</p>
                ) : null}
              </div>

              {/* Format hint */}
              <div className="space-y-1 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 text-xs text-[#64748B]">
                <p className="mb-1 font-medium text-[#0F172A]">Định dạng template chuẩn:</p>
                <p>Cột 1: Mã khu vực — khớp zone</p>
                <p>Cột 2: Tên (xuất từ hệ thống; import không đổi tên qua file)</p>
                <p>
                  Cột 3: Trạng thái — nhãn tiếng Việt như export hoặc mã (not_started, in_progress…)
                </p>
                <p>Cột 4: Tiến độ (%) — 0–100</p>
                <p>
                  Cột 5: <strong>Phụ trách</strong> — cập nhật trường «Giao cho» (assignee) trên zone khi áp dụng
                </p>
                <p>Cột 6: Deadline — ngày (Excel hoặc YYYY-MM-DD)</p>
                <p>Cột 7: Hạng mục (tasks) — import MVP chưa đổi cột này</p>
                <p>Cột 8: Ghi chú</p>
                <p className="mt-2 text-amber-600 font-medium">
                  ⚠ Chỉ cập nhật zone đã có — KHÔNG tạo zone mới từ Excel.
                </p>
              </div>

              {err ? <p className="text-sm text-red-600">{err}</p> : null}
            </div>
          ) : null}

          {/* ── Stage 2: Preview ── */}
          {stage === 'preview' ? (
            <div className="space-y-4">
              {/* Summary chips */}
              <div className="flex flex-wrap gap-3 text-sm">
                <span className="rounded-full bg-emerald-100 px-3 py-1 font-medium text-emerald-700">
                  ✓ Tìm thấy: {foundRows.length} zone
                </span>
                {notFoundRows.length > 0 ? (
                  <span className="rounded-full bg-amber-100 px-3 py-1 font-medium text-amber-700">
                    ⚠ Không tìm thấy: {notFoundRows.length} dòng
                  </span>
                ) : null}
              </div>

              {/* Preview table */}
              <div className="overflow-x-auto rounded-xl border border-[#E2E8F0] text-xs">
                <table className="min-w-full text-[#0F172A]">
                  <thead className="bg-[#F1F5F9] text-left text-[#334155]">
                    <tr>
                      <th className="px-3 py-2 font-medium">Dòng</th>
                      <th className="px-3 py-2 font-medium">Mã khu vực</th>
                      <th className="px-3 py-2 font-medium">Trạng thái cũ</th>
                      <th className="px-3 py-2 font-medium">Trạng thái mới</th>
                      <th className="px-3 py-2 font-medium">Tiến độ (%)</th>
                      <th className="px-3 py-2 font-medium">Phụ trách → Giao cho</th>
                      <th className="px-3 py-2 font-medium">Deadline</th>
                      <th className="px-3 py-2 font-medium">Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row) => (
                      <tr key={row.row}
                        className={`border-t ${row.found ? 'hover:bg-muted/20' : 'bg-amber-50 text-amber-800'}`}>
                        <td className="px-3 py-2 text-muted-foreground">{row.row}</td>
                        <td className="px-3 py-2 font-mono font-medium">{row.zone_code}</td>
                        <td className="px-3 py-2">
                          {row.found
                            ? (STATUS_VI[row.current_status ?? ''] ?? row.current_status ?? '—')
                            : <span className="text-amber-600 font-medium">Không tìm thấy</span>}
                        </td>
                        <td className="px-3 py-2">
                          {row.found && row.new_status
                            ? STATUS_VI[row.new_status] ?? row.new_status
                            : '—'}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {row.found ? (
                            <span>
                              <span className="text-[#64748B]">{row.current_completion_pct ?? '—'}%</span>
                              <span className="mx-1 text-[#94A3B8]">→</span>
                              <span className="font-medium">
                                {row.new_completion_pct != null ? `${row.new_completion_pct}%` : '—'}
                              </span>
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-3 py-2 max-w-[140px]">
                          {row.found ? (
                            <span className="block truncate" title={row.new_assignee ?? ''}>
                              {row.new_assignee != null && row.new_assignee !== '' ? (
                                <>
                                  <span className="text-[#64748B] truncate block">
                                    {row.current_assignee?.trim() ? row.current_assignee : '—'}
                                  </span>
                                  <span className="text-[#94A3B8]">→ </span>
                                  <span className="font-medium">{row.new_assignee}</span>
                                </>
                              ) : (
                                <span className="text-[#64748B]">{row.current_assignee?.trim() || '—'}</span>
                              )}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">{row.new_deadline ?? '—'}</td>
                        <td className="px-3 py-2 max-w-[140px] truncate" title={row.new_notes ?? ''}>
                          {row.new_notes?.trim() ? row.new_notes : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {foundRows.length === 0 ? (
                <p className="text-sm text-amber-700 font-medium">
                  ⚠ Không có zone nào khớp với file Excel. Kiểm tra lại cột mã khu vực.
                </p>
              ) : null}

              {err ? <p className="text-sm text-red-600">{err}</p> : null}
            </div>
          ) : null}

          {/* ── Stage 3: Applied ── */}
          {stage === 'applied' && applyResult ? (
            <div className="space-y-4 py-4 text-center">
              <div className="text-5xl">✅</div>
              <p className="text-lg font-semibold">Áp dụng thành công!</p>
              <div className="flex justify-center gap-6 text-sm">
                <div className="rounded-lg border bg-emerald-50 px-6 py-4">
                  <p className="text-2xl font-bold text-emerald-600">{applyResult.success_count}</p>
                  <p className="text-muted-foreground">zone đã cập nhật</p>
                </div>
                {applyResult.not_found_count > 0 ? (
                  <div className="rounded-lg border bg-amber-50 px-6 py-4">
                    <p className="text-2xl font-bold text-amber-600">{applyResult.not_found_count}</p>
                    <p className="text-muted-foreground">zone không tìm thấy</p>
                  </div>
                ) : null}
              </div>
              {(applyResult.errors ?? []).length > 0 ? (
                <div className="rounded-lg border bg-red-50 p-3 text-left text-xs text-red-700">
                  <p className="font-medium mb-1">Lỗi chi tiết:</p>
                  <ul className="space-y-0.5">
                    {(applyResult.errors ?? []).map((e, i) => <li key={i}>• {e}</li>)}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Footer actions */}
        <div className="flex justify-end gap-2 border-t border-[#E2E8F0] bg-[#F8FAFC] px-5 py-4">
          {stage === 'upload' ? (
            <>
              <button type="button" onClick={onClose}
                className="rounded-md border px-4 py-2 text-sm">
                Hủy
              </button>
              <button
                type="button"
                onClick={() => void upload()}
                disabled={!file || uploading}
                className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-60"
              >
                {uploading ? 'Đang phân tích...' : 'Phân tích file →'}
              </button>
            </>
          ) : null}

          {stage === 'preview' ? (
            <>
              <button type="button"
                onClick={() => { setStage('upload'); setImportJob(null); setFile(null) }}
                className="rounded-md border px-4 py-2 text-sm">
                ← Chọn lại file
              </button>
              <button
                type="button"
                onClick={() => void apply()}
                disabled={applying || foundRows.length === 0}
                className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-60"
              >
                {applying ? 'Đang áp dụng...' : `Áp dụng ${foundRows.length} zone →`}
              </button>
            </>
          ) : null}

          {stage === 'applied' ? (
            <button
              type="button"
              onClick={() => {
                void fetchZonesAndMarks(layerId)
                onClose()
              }}
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
            >
              Đóng
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

// ─── ExportButton ──────────────────────────────────────────────────────────────

function ExportButton({ projectId }: { projectId: number }) {
  const [exporting, setExporting] = useState(false)
  const [exportErr, setExportErr] = useState<string | null>(null)

  const doExport = async () => {
    setExporting(true); setExportErr(null)
    try {
      const resp = await client.get(`/projects/${projectId}/export/excel`, {
        responseType: 'blob',
      })
      const blob = new Blob([(resp as { data: BlobPart }).data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `project-${projectId}-export.xlsx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      setExportErr('Xuất thất bại. Vui lòng thử lại.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => void doExport()}
        disabled={exporting}
        className="inline-flex items-center gap-2 rounded-md border bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
      >
        {exporting ? '⏳ Đang xuất...' : '⬇ Xuất Excel toàn dự án'}
      </button>
      {exportErr ? <p className="text-xs text-red-600">{exportErr}</p> : null}
    </div>
  )
}

// ─── SettingsTab ───────────────────────────────────────────────────────────────

type ShareLink = {
  id: number
  token: string
  role: string
  expires_at: string | null
  revoked_at: string | null
  created_at: string
}


function SettingsTab({
  project,
  projectRole,
  onProjectUpdate,
}: {
  project: ProjectData
  projectRole: 'admin' | 'project_manager' | 'field_team' | 'viewer' | null
  onProjectUpdate: (updated: ProjectData) => void
}) {
  const canManage = projectRole === 'admin' || projectRole === 'project_manager'

  // ── Edit project state ───────────────────────────────────────────────────
  const [editName, setEditName] = useState(project.name)
  const [editDescription, setEditDescription] = useState(project.description ?? '')
  const [editAddress, setEditAddress] = useState(project.address ?? '')
  const [saving, setSaving] = useState(false)
  const [saveErr, setSaveErr] = useState<string | null>(null)
  const [saveOk, setSaveOk] = useState(false)

  const saveProject = async () => {
    if (!editName.trim()) { setSaveErr('Tên dự án là bắt buộc.'); return }
    setSaving(true); setSaveErr(null); setSaveOk(false)
    try {
      const resp = (await client.put(`/projects/${project.id}`, {
        name: editName.trim(),
        description: editDescription.trim() || null,
        address: editAddress.trim() || null,
      })) as { data: ApiResponse<ProjectData> }
      onProjectUpdate(resp.data.data)
      setSaveOk(true)
      setTimeout(() => setSaveOk(false), 3000)
    } catch (e) {
      setSaveErr(parseApiError(e, 'Lưu thất bại.'))
    } finally {
      setSaving(false)
    }
  }

  // ── Share links state ────────────────────────────────────────────────────
  const [shareLinks, setShareLinks] = useState<ShareLink[]>([])
  const [shareLoading, setShareLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [expiresDays, setExpiresDays] = useState<1 | 7 | 30>(7)
  const [shareErr, setShareErr] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<number | null>(null)

  useEffect(() => {
    setShareLoading(true)
    void (client.get(`/projects/${project.id}/share-links`) as Promise<{ data: ApiResponse<ShareLink[]> }>)
      .then((r) => setShareLinks(r.data.data ?? []))
      .catch(() => setShareErr('Không tải được share links.'))
      .finally(() => setShareLoading(false))
  }, [project.id])

  const createLink = async () => {
    setCreating(true); setShareErr(null)
    try {
      const resp = (await client.post(`/projects/${project.id}/share-links`, {
        expires_in_days: expiresDays,
      })) as { data: ApiResponse<ShareLink> }
      setShareLinks((prev) => [resp.data.data, ...prev])
    } catch (e) {
      setShareErr(parseApiError(e, 'Tạo link thất bại.'))
    } finally {
      setCreating(false)
    }
  }

  const revokeLink = async (linkId: number) => {
    if (!confirm('Thu hồi link này? Người xem sẽ không truy cập được nữa.')) return
    try {
      await client.delete(`/share-links/${linkId}`)
      setShareLinks((prev) =>
        prev.map((l) => (l.id === linkId ? { ...l, revoked_at: new Date().toISOString() } : l)),
      )
    } catch (e) {
      setShareErr(parseApiError(e, 'Thu hồi thất bại.'))
    }
  }

  const copyLink = async (token: string, linkId: number) => {
    const url = `${window.location.origin}/share/${token}`
    try {
      await navigator.clipboard.writeText(url)
      setCopiedId(linkId)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      prompt('Copy link:', url)
    }
  }

  const isActive = (link: ShareLink) => {
    if (link.revoked_at) return false
    if (!link.expires_at) return true
    return new Date(link.expires_at) > new Date()
  }

  const fmtDate = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : '—'

  return (
    <div className="space-y-8 max-w-2xl">

      {/* ── Edit project info ─────────────────────────────────────────── */}
      <section className="space-y-4">
        <h3 className="text-base font-semibold">Thông tin dự án</h3>

        {canManage ? (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium">
                Tên dự án <span className="text-red-500">*</span>
              </label>
              <input
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Mô tả</label>
              <textarea
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                rows={2}
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Mô tả dự án (tuỳ chọn)"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Địa chỉ công trình</label>
              <input
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={editAddress}
                onChange={(e) => setEditAddress(e.target.value)}
                placeholder="VD: 123 Nguyễn Huệ, Q1, TP.HCM"
              />
            </div>

            {saveErr ? <p className="text-xs text-red-600">{saveErr}</p> : null}
            {saveOk ? <p className="text-xs text-emerald-600">✓ Đã lưu thành công.</p> : null}

            <button
              type="button"
              onClick={() => void saveProject()}
              disabled={saving}
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-60"
            >
              {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          </div>
        ) : (
          <div className="rounded-lg border bg-muted/30 p-4 text-sm space-y-1">
            <p><span className="font-medium">Tên:</span> {project.name}</p>
            {project.description ? <p><span className="font-medium">Mô tả:</span> {project.description}</p> : null}
            {project.address ? <p><span className="font-medium">Địa chỉ:</span> {project.address}</p> : null}
          </div>
        )}
      </section>

      {/* ── Export ──────────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h3 className="text-base font-semibold">Xuất dữ liệu</h3>
        <ExportButton projectId={project.id} />
        <p className="text-xs text-muted-foreground">
          Xuất toàn bộ mặt bằng, khu vực và tiến độ ra file .xlsx.
        </p>
      </section>

      {/* ── Share Links ──────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">Link chia sẻ</h3>
          <span className="text-xs text-muted-foreground">Người xem không cần đăng nhập</span>
        </div>

        {shareErr ? (
          <p className="text-xs text-red-600">{shareErr}</p>
        ) : null}

        {/* Create new link */}
        {canManage ? (
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-3">
            <span className="text-xs font-medium text-muted-foreground shrink-0">Hết hạn sau</span>
            <select
              value={expiresDays}
              onChange={(e) => setExpiresDays(Number(e.target.value) as 1 | 7 | 30)}
              className="rounded-md border bg-background px-2 py-1 text-sm"
            >
              <option value={1}>1 ngày</option>
              <option value={7}>7 ngày</option>
              <option value={30}>30 ngày</option>
            </select>
            <button
              type="button"
              onClick={() => void createLink()}
              disabled={creating}
              className="ml-auto rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-60"
            >
              {creating ? 'Đang tạo...' : '+ Tạo link mới'}
            </button>
          </div>
        ) : null}

        {/* Links list */}
        {shareLoading ? (
          <p className="text-sm text-muted-foreground">Đang tải...</p>
        ) : shareLinks.length === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa có link nào được tạo.</p>
        ) : (
          <ul className="space-y-2">
            {shareLinks.map((link) => {
              const active = isActive(link)
              return (
                <li
                  key={link.id}
                  className={`rounded-lg border p-3 ${active ? 'bg-card' : 'bg-muted/30 opacity-60'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      {/* Token (truncated) */}
                      <p className="font-mono text-xs text-muted-foreground truncate">
                        /share/{link.token}
                      </p>
                      {/* Meta */}
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                        <span>
                          {active ? (
                            <span className="text-emerald-600 font-medium">● Còn hiệu lực</span>
                          ) : link.revoked_at ? (
                            <span className="text-red-500">✕ Đã thu hồi</span>
                          ) : (
                            <span className="text-amber-600">⚠ Hết hạn</span>
                          )}
                        </span>
                        <span>Vai trò: <strong>Xem</strong></span>
                        {link.expires_at ? <span>Hết hạn: {fmtDate(link.expires_at)}</span> : null}
                        <span>Tạo: {fmtDate(link.created_at)}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex shrink-0 gap-2">
                      {active ? (
                        <button
                          type="button"
                          onClick={() => void copyLink(link.token, link.id)}
                          className="rounded-md border px-2.5 py-1 text-xs hover:bg-muted"
                        >
                          {copiedId === link.id ? '✓ Đã copy' : '📋 Copy'}
                        </button>
                      ) : null}
                      {canManage && active ? (
                        <button
                          type="button"
                          onClick={() => void revokeLink(link.id)}
                          className="rounded-md border border-red-200 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50"
                        >
                          Thu hồi
                        </button>
                      ) : null}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
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
      const resp = (await client.post(`/master-layers/${mlId}/layers`, formData)) as {
        data: ApiResponse<LayerItem>
      }
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
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6">
        <Link
          to="/projects"
          className="inline-flex cursor-pointer items-center gap-1.5 text-sm text-[#64748B] transition hover:text-[#0F172A]"
        >
          <ChevronLeft size={16} />
          Danh sách dự án
        </Link>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="h-8 w-64 animate-pulse rounded-xl bg-[#F1F5F9]" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[1,2,3,4,5,6].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl bg-[#F1F5F9]" />
            ))}
          </div>
        </div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      {!loading && !error && project ? (
        <section className="space-y-6 rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
          {/* Project header */}
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#FFF3E8]">
              <Building2 size={22} className="text-[#FF7F29]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-[#FFF3E8] px-2.5 py-0.5 font-mono text-xs font-semibold text-[#FF7F29]">
                  {project.code}
                </span>
              </div>
              <h1 className="mt-1 text-xl font-bold text-[#0F172A]">{project.name}</h1>
              {project.description ? (
                <p className="mt-0.5 text-sm text-[#64748B]">{project.description}</p>
              ) : null}
              {project.address ? (
                <div className="mt-1 flex items-center gap-1.5 text-sm text-[#94A3B8]">
                  <MapPin size={13} />
                  <span>{project.address}</span>
                </div>
              ) : null}
            </div>
          </div>

          {/* Stats — Bento Grid */}
          {project.stats ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <Stat label="Tổng zone" value={project.stats.total_zones ?? 0}
                icon={<Layers size={16} />} />
              <Stat label="Hoàn thành" value={project.stats.completed ?? 0}
                icon={<CheckCircle2 size={16} />} />
              <Stat label="Đang thi công" value={project.stats.in_progress ?? 0}
                icon={<HardHat size={16} />} />
              <Stat label="Trì hoãn" value={project.stats.delayed ?? 0}
                icon={<AlertTriangle size={16} />} />
              <Stat label="Tạm dừng" value={project.stats.paused ?? 0}
                icon={<PauseCircle size={16} />} />
              <Stat
                label="Tiến độ"
                value={`${Math.round(project.stats.progress_pct ?? 0)}%`}
                icon={<TrendingUp size={16} />}
                highlight
              />
            </div>
          ) : null}

          {/* Tabs */}
          <div className="border-t pt-5">
            {/* Scrollable tabs on mobile */}
            <div className="mb-4 flex gap-2 overflow-x-auto border-b pb-3 scrollbar-none [-ms-overflow-style:none] [scrollbar-width:none]">
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

            {activeTab === 'settings' ? (
              <SettingsTab
                project={project}
                projectRole={projectRole}
                onProjectUpdate={(updated) => setProject((prev) => (prev ? { ...prev, ...updated } : prev))}
              />
            ) : null}
          </div>
        </section>
      ) : null}
    </main>
  )
}
