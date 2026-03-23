import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useParams } from 'react-router-dom'
import { CheckCircle2, ChevronLeft, FileDown } from 'lucide-react'

import client from '@/api/client'
import CanvasToolbar from '@/components/canvas/CanvasToolbar'
import type { CanvasDrawMode } from '@/components/canvas/CanvasToolbar'
import CanvasWrapper from '@/components/canvas/CanvasWrapper'
import ExportMarqueeOverlay from '@/components/canvas/ExportMarqueeOverlay'
import PolygonLayer, { type FabricCanvasHandle } from '@/components/canvas/PolygonLayer'
import TileLayer from '@/components/canvas/TileLayer'
import ZoomControls from '@/components/canvas/ZoomControls'
import { ZONE_STATUS, ZONE_STATUS_COLOR } from '@/lib/constants'
import { exportLayerPdf, type PdfCropRect } from '@/lib/canvasPdfExport'
import { parseApiError } from '@/lib/parseApiError'
import {
  activityAvatarColor,
  activityScopeTag,
  activityUserInitials,
  describeActivityLog,
  formatRelativeTimeVi,
  type ActivityLogEntry,
} from '@/lib/activityLogDisplay'
import { resolveZoneAssigneeDisplay } from '@/lib/zoneAssigneeDisplay'
import type { Zone, Geometry } from '@/stores/canvasStore'
import useCanvasStore from '@/stores/canvasStore'
import useAuthStore from '@/stores/authStore'

// ─── Types ──────────────────────────────────────────────────────────────────

type LayerInfo = {
  id: number
  name: string
  status: 'pending' | 'processing' | 'ready' | 'error'
  width_px: number | null
  height_px: number | null
}

type ApiResponse<T> = { success: boolean; data: T }

/** geometry_pct gửi API: luôn polygon với points {x,y} 0–1 */
function geometryToApiPolygon(geo: Geometry): { type: 'polygon'; points: { x: number; y: number }[] } {
  let rawPoints: [number, number][]
  if (geo.type === 'rect') {
    const x = geo.x ?? 0
    const y = geo.y ?? 0
    const w = geo.width ?? 0
    const h = geo.height ?? 0
    rawPoints = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]
  } else {
    rawPoints = (geo.points ?? []) as [number, number][]
  }
  return { type: 'polygon', points: rawPoints.map(([px, py]) => ({ x: px, y: py })) }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  not_started: 'Chưa bắt đầu',
  in_progress: 'Đang thi công',
  completed: 'Hoàn thành',
  delayed: 'Trễ',
  paused: 'Tạm dừng',
}

// ─── ZoneCreateModal ────────────────────────────────────────────────────────

function ZoneCreateModal({
  onSave,
  onCancel,
  loading,
}: {
  onSave: (data: {
    name: string
    deadline: string
    tasks: string
    notes: string
  }) => Promise<void>
  onCancel: () => void
  loading: boolean
}) {
  const [name, setName] = useState('')
  const [deadline, setDeadline] = useState('')
  const [tasks, setTasks] = useState('')
  const [notes, setNotes] = useState('')
  const [err, setErr] = useState<string | null>(null)

  const submit = async () => {
    if (!name.trim()) { setErr('Tên khu vực là bắt buộc.'); return }
    setErr(null)
    try {
      await onSave({ name: name.trim(), deadline, tasks, notes })
    } catch (e) {
      setErr(parseApiError(e, 'Tạo khu vực thất bại.'))
    }
  }

  const fieldCls =
    'w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] placeholder:text-[#94A3B8] shadow-sm transition focus:border-[#FF7F29] focus:outline-none focus:ring-2 focus:ring-[#FF7F29]/25'

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#0F172A]/55 p-4 backdrop-blur-sm"
      role="presentation"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_25px_50px_-12px_rgba(15,23,42,0.35)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="zone-create-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-[#E2E8F0] bg-[#F8FAFC] px-6 py-4">
          <div className="border-l-4 border-[#FF7F29] pl-3">
            <h2 id="zone-create-modal-title" className="text-lg font-semibold text-[#0F172A]">
              Thông tin khu vực mới
            </h2>
            <p className="mt-0.5 text-xs text-[#64748B]">
              Nhập tên và thông tin bổ sung. Giao cho thành viên dự án thì chỉnh ở panel Chi tiết sau khi tạo.
            </p>
          </div>
        </div>
        <div className="space-y-3 p-6">
          <div>
            <label className="mb-1 block text-xs font-medium text-[#0F172A]">
              Tên khu vực <span className="text-red-500">*</span>
            </label>
            <input
              autoFocus
              className={fieldCls}
              placeholder="VD: Phòng 101A"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void submit() }}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#0F172A]">Deadline</label>
            <input
              type="date"
              className={fieldCls}
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#0F172A]">Công việc</label>
            <input
              className={fieldCls}
              placeholder="Mô tả công việc (tuỳ chọn)"
              value={tasks}
              onChange={(e) => setTasks(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#0F172A]">Ghi chú</label>
            <textarea
              className={`${fieldCls} resize-y`}
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          {err ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{err}</div>
          ) : null}
        </div>
        <div className="flex justify-end gap-2 border-t border-[#E2E8F0] bg-[#F8FAFC] px-6 py-4">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-[#E2E8F0] bg-white px-4 py-2 text-sm font-medium text-[#0F172A] transition hover:bg-[#F8FAFC]"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={loading}
            className="rounded-xl bg-[#FF7F29] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#E5691D] disabled:opacity-60"
          >
            {loading ? 'Đang lưu...' : 'Tạo khu vực'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Comment types ───────────────────────────────────────────────────────────

type Comment = {
  id: number
  zone_id: number
  user_id: number
  user_name: string
  content: string | null
  images: string[]
  created_at: string
}

// ─── History types (API ActivityLogResource) ─────────────────────────────────

type HistoryEntry = ActivityLogEntry

// ─── CommentsTab ─────────────────────────────────────────────────────────────

const MAX_IMAGE_BYTES = 10 * 1024 * 1024 // 10 MB per file
const MAX_IMAGES_PER_COMMENT = 5

/** Backend lưu path dạng `comments/{id}/uuid.png`; route GET chỉ nhận basename (xem ZoneCommentController::image). */
function commentImageBasename(storedPath: string): string {
  const s = String(storedPath).trim().replace(/\\/g, '/')
  const parts = s.split('/').filter(Boolean)
  return parts[parts.length - 1] ?? s
}

function CommentsTab({ zone, isPM }: { zone: Zone; isPM: boolean }) {
  const { user } = useAuthStore()
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [posting, setPosting] = useState(false)
  const [text, setText] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [err, setErr] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setLoading(true)
    setComments([])
    void (client.get(`/zones/${zone.id}/comments`) as Promise<{ data: ApiResponse<Comment[]> }>)
      .then((r) => setComments(r.data.data ?? []))
      .catch(() => setErr('Không tải được bình luận.'))
      .finally(() => setLoading(false))
  }, [zone.id])

  const submit = async () => {
    if (!text.trim() && files.length === 0) return
    if (files.length > MAX_IMAGES_PER_COMMENT) {
      setErr(`Tối đa ${MAX_IMAGES_PER_COMMENT} ảnh mỗi bình luận.`)
      return
    }
    const oversized = files.find((f) => f.size > MAX_IMAGE_BYTES)
    if (oversized) { setErr(`"${oversized.name}" vượt quá 10 MB.`); return }
    setPosting(true); setErr(null)
    try {
      const fd = new FormData()
      if (text.trim()) fd.append('content', text.trim())
      files.forEach((f) => fd.append('images[]', f))
      // KHÔNG set Content-Type thủ công — thiếu boundary khiến Laravel không nhận file → chỉ lưu text / Validation failed
      const resp = (await client.post(`/zones/${zone.id}/comments`, fd)) as { data: ApiResponse<Comment> }
      setComments((prev) => [...prev, resp.data.data])
      setText('')
      setFiles([])
      if (fileRef.current) fileRef.current.value = ''
    } catch (e) {
      setErr(parseApiError(e, 'Gửi thất bại.'))
    } finally {
      setPosting(false)
    }
  }

  const deleteComment = async (id: number) => {
    if (!confirm('Xóa bình luận này?')) return
    try {
      await client.delete(`/comments/${id}`)
      setComments((prev) => prev.filter((c) => c.id !== id))
    } catch (e) {
      setErr(parseApiError(e, 'Xóa thất bại.'))
    }
  }

  const BASE = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'

  return (
    <div className="flex flex-col gap-2 p-3">
      {loading ? (
        <p className="text-center text-xs text-muted-foreground py-4">Đang tải...</p>
      ) : comments.length === 0 ? (
        <p className="text-center text-xs text-muted-foreground py-4">Chưa có bình luận.</p>
      ) : (
        <ul className="space-y-2 max-h-52 overflow-y-auto">
          {comments.map((c) => (
            <li key={c.id} className="rounded-lg border bg-muted/30 p-2 text-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium">{c.user_name}</span>
                <span className="text-muted-foreground text-[10px]">
                  {new Date(c.created_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              {c.content ? <p className="mb-1 text-xs">{c.content}</p> : null}
              {c.images.length > 0 ? (
                <div className="flex flex-wrap gap-1 mt-1">
                  {c.images.map((img) => {
                    const basename = commentImageBasename(img)
                    const imgUrl = `${BASE}/comments/${c.id}/images/${encodeURIComponent(basename)}`
                    return (
                      <a key={`${c.id}-${img}`} href={imgUrl} target="_blank" rel="noreferrer">
                        <img
                          src={imgUrl}
                          alt={basename}
                          className="h-12 w-12 rounded object-cover border"
                        />
                      </a>
                    )
                  })}
                </div>
              ) : null}
              {(user?.id === c.user_id || isPM) ? (
                <button
                  type="button"
                  onClick={() => void deleteComment(c.id)}
                  className="mt-1 text-[10px] text-red-500 hover:underline"
                >
                  Xóa
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {err ? <p className="text-xs text-red-600">{err}</p> : null}

      <div className="space-y-1.5 border-t pt-2">
        <textarea
          className="w-full rounded-md border bg-background px-2 py-1.5 text-xs"
          rows={2}
          placeholder="Nhập bình luận..."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="flex items-center gap-2">
          <label className="cursor-pointer rounded-md border px-2 py-1 text-xs text-muted-foreground hover:bg-muted">
            📎 Ảnh ({files.length}/{MAX_IMAGES_PER_COMMENT})
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const all = Array.from(e.target.files ?? [])
                if (all.length > MAX_IMAGES_PER_COMMENT) {
                  setErr(`Tối đa ${MAX_IMAGES_PER_COMMENT} ảnh mỗi bình luận.`)
                  e.target.value = ''
                  setFiles([])
                  return
                }
                const oversized = all.find((f) => f.size > MAX_IMAGE_BYTES)
                if (oversized) {
                  setErr(`"${oversized.name}" vượt quá 10 MB.`)
                  e.target.value = ''
                  setFiles([])
                  return
                }
                setErr(null)
                setFiles(all)
              }}
            />
          </label>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={
              posting ||
              (!text.trim() && files.length === 0) ||
              files.length > MAX_IMAGES_PER_COMMENT
            }
            className="ml-auto rounded-md bg-primary px-3 py-1 text-xs text-primary-foreground disabled:opacity-60"
          >
            {posting ? 'Đang gửi...' : 'Gửi'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── HistoryTab — timeline kiểu dashboard (chi tiết từ changes) ──────────────

function HistoryTab({ zone, isPM, layerId }: { zone: Zone; isPM: boolean; layerId: number }) {
  const { updateZone, fetchZonesAndMarks } = useCanvasStore()
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [rollingBack, setRollingBack] = useState<number | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const canRollback = isPM

  useEffect(() => {
    setLoading(true)
    setEntries([])
    void (client.get(`/zones/${zone.id}/history`) as Promise<{ data: ApiResponse<HistoryEntry[]> }>)
      .then((r) => setEntries(r.data.data ?? []))
      .catch(() => setErr('Không tải được lịch sử.'))
      .finally(() => setLoading(false))
  }, [zone.id])

  const rollback = async (logId: number) => {
    if (!confirm('Hoàn tác thay đổi này?')) return
    setRollingBack(logId); setErr(null)
    try {
      const resp = (await client.post(`/activity-logs/${logId}/rollback`)) as {
        data: ApiResponse<Zone>
      }
      updateZone(resp.data.data)
      void fetchZonesAndMarks(layerId)
      const h = (await client.get(`/zones/${zone.id}/history`)) as {
        data: ApiResponse<HistoryEntry[]>
      }
      setEntries(h.data.data ?? [])
    } catch (e) {
      setErr(parseApiError(e, 'Khôi phục thất bại.'))
    } finally {
      setRollingBack(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-3 p-3">
        <div className="h-24 animate-pulse rounded-xl bg-muted/60" />
        <div className="h-24 animate-pulse rounded-xl bg-muted/60" />
      </div>
    )
  }

  return (
    <div className="p-3">
      {err ? (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {err}
        </div>
      ) : null}

      <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground">
        Lịch sử khu <span className="font-medium text-foreground">«{zone.name}»</span> — gồm thao tác trên
        vùng và các mark tiến độ trong vùng. Thời gian hiển thị dạng tương đối.
      </p>

      {entries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-muted-foreground/25 bg-muted/20 py-10 text-center">
          <p className="text-sm font-medium text-muted-foreground">Chưa có hoạt động</p>
          <p className="mt-1 text-xs text-muted-foreground/80">
            Khi có thay đổi trạng thái, tiến độ hoặc mark, lịch sử sẽ hiện tại đây.
          </p>
        </div>
      ) : (
        <ul className="max-h-[min(420px,52vh)] space-y-3 overflow-y-auto pr-0.5">
          {entries.map((e) => {
            const canRb = canRollback && e.action !== 'restored' && !e.restored_from_log_id
            const desc = describeActivityLog(e, zone.name)
            const tag = activityScopeTag(desc.scope)
            const avatarBg = activityAvatarColor(e.user_name)
            const initials = activityUserInitials(e.user_name)

            return (
              <li
                key={e.id}
                className="rounded-xl border border-[#E2E8F0] bg-white p-3 shadow-sm transition hover:shadow-md"
              >
                <div className="flex gap-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white shadow-inner"
                    style={{ backgroundColor: avatarBg }}
                    aria-hidden
                  >
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
                      <p className="min-w-0 text-sm leading-snug text-[#0F172A]">
                        <span className="font-semibold">{e.user_name}</span>{' '}
                        <span className="text-[#334155]">{desc.summary}</span>
                      </p>
                      <time
                        className="shrink-0 text-[11px] text-[#94A3B8]"
                        dateTime={e.created_at}
                        title={new Date(e.created_at).toLocaleString('vi-VN')}
                      >
                        {formatRelativeTimeVi(e.created_at)}
                      </time>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${tag.className}`}
                      >
                        {tag.label}
                      </span>
                      <span className="text-[10px] text-[#94A3B8]">
                        #{e.id}
                        {e.target_id != null ? ` · ref ${e.target_id}` : ''}
                      </span>
                    </div>

                    {desc.lines.length > 0 ? (
                      <div className="mt-2.5 space-y-1.5 border-t border-[#F1F5F9] pt-2.5">
                        {desc.lines.map((line) => (
                          <div key={line.id} className="text-xs leading-relaxed">
                            {line.kind === 'status_arrow' || line.kind === 'pct_arrow' ? (
                              <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                                <span
                                  className={
                                    line.accent === 'amber'
                                      ? 'font-medium text-amber-800'
                                      : line.accent === 'emerald'
                                        ? 'font-medium text-emerald-800'
                                        : 'text-[#475569]'
                                  }
                                >
                                  {line.left}
                                </span>
                                {line.arrow ? (
                                  <span className="font-medium text-[#94A3B8]">{line.arrow}</span>
                                ) : null}
                                {line.right != null ? (
                                  <span
                                    className={
                                      line.kind === 'pct_arrow'
                                        ? 'font-semibold text-[#059669]'
                                        : 'font-semibold text-[#B45309]'
                                    }
                                  >
                                    {line.right}
                                  </span>
                                ) : null}
                              </span>
                            ) : (
                              <span className="text-[#475569]">{line.left}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {canRb ? (
                      <div className="mt-2.5 flex justify-end border-t border-[#F1F5F9] pt-2">
                        <button
                          type="button"
                          disabled={rollingBack === e.id}
                          onClick={() => void rollback(e.id)}
                          className="rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-2.5 py-1 text-[11px] font-medium text-[#1D4ED8] transition hover:bg-[#DBEAFE] disabled:opacity-60"
                        >
                          {rollingBack === e.id ? 'Đang hoàn tác…' : 'Hoàn tác (rollback)'}
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

// ─── ZoneDetailPanel ─────────────────────────────────────────────────────────

type PanelTab = 'detail' | 'comments' | 'history'

type Member = { user: { id: number; name: string; email: string }; role: string }

function ZoneDetailPanel({
  zone,
  layerId,
  projectId,
  onClose,
}: {
  zone: Zone
  layerId: number
  projectId: number
  onClose: () => void
}) {
  const { user } = useAuthStore()
  const { updateZone, removeZone } = useCanvasStore()
  const [tab, setTab] = useState<PanelTab>('detail')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [status, setStatus] = useState(zone.status)
  const [pct, setPct] = useState(zone.completion_pct)
  const [notes, setNotes] = useState(zone.notes ?? '')
  const [deadline, setDeadline] = useState(zone.deadline ?? '')
  const [assignedUserId, setAssignedUserId] = useState<number | null>(zone.assigned_user_id ?? null)
  const [err, setErr] = useState<string | null>(null)
  /** Success toast — portal to document.body so luôn nổi trên canvas/sidebar */
  const [saveToastVisible, setSaveToastVisible] = useState(false)
  const saveToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [members, setMembers] = useState<Member[]>([])

  const MIN_SAVE_INDICATOR_MS = 550
  const SAVE_TOAST_DURATION_MS = 4200

  // Fetch project members for assignee dropdown
  useEffect(() => {
    const load = async () => {
      try {
        const resp = (await client.get(`/projects/${projectId}/members`)) as {
          data: ApiResponse<Member[]>
        }
        setMembers(resp.data.data ?? [])
      } catch {
        // silent — assignee dropdown stays empty
      }
    }
    void load()
  }, [projectId])

  // Reset form when zone changes
  useEffect(() => {
    setStatus(zone.status)
    setPct(zone.completion_pct)
    setNotes(zone.notes ?? '')
    setDeadline(zone.deadline ?? '')
    setAssignedUserId(zone.assigned_user_id ?? null)
    setErr(null)
    setTab('detail')
    setSaveToastVisible(false)
    if (saveToastTimeoutRef.current) {
      clearTimeout(saveToastTimeoutRef.current)
      saveToastTimeoutRef.current = null
    }
  }, [zone.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      if (saveToastTimeoutRef.current) clearTimeout(saveToastTimeoutRef.current)
    }
  }, [])

  const isPM = user?.role === 'admin' ||
    user?.projects.some((p) => p.role === 'project_manager') === true

  const assigneeDisplay = resolveZoneAssigneeDisplay(zone, members)

  const save = async () => {
    setSaving(true); setErr(null)
    if (saveToastTimeoutRef.current) {
      clearTimeout(saveToastTimeoutRef.current)
      saveToastTimeoutRef.current = null
    }
    setSaveToastVisible(false)
    const started = Date.now()
    try {
      let resp: { data: ApiResponse<Zone> }
      if (status !== zone.status) {
        // Status is changing — use PATCH /status (state machine)
        resp = (await client.patch(`/zones/${zone.id}/status`, {
          status,
          completion_pct: pct,
          notes,
          deadline: deadline || null,
        })) as { data: ApiResponse<Zone> }
      } else {
        // Only updating fields — use PUT /zones/{id}
        resp = (await client.put(`/zones/${zone.id}`, {
          name: zone.name,
          completion_pct: pct,
          notes,
          deadline: deadline || null,
          assigned_user_id: assignedUserId ?? null,
        })) as { data: ApiResponse<Zone> }
      }
      updateZone(resp.data.data)
      // Giữ "Đang lưu..." tối thiểu MIN_SAVE_INDICATOR_MS để người dùng kịp nhận ra
      const elapsed = Date.now() - started
      if (elapsed < MIN_SAVE_INDICATOR_MS) {
        await new Promise((r) => setTimeout(r, MIN_SAVE_INDICATOR_MS - elapsed))
      }
      setSaveToastVisible(true)
      saveToastTimeoutRef.current = setTimeout(() => {
        setSaveToastVisible(false)
        saveToastTimeoutRef.current = null
      }, SAVE_TOAST_DURATION_MS)
    } catch (e) {
      setErr(parseApiError(e, 'Lưu thất bại.'))
    } finally {
      setSaving(false)
    }
  }

  const del = async () => {
    if (!confirm(`Xóa khu vực "${zone.name}"?`)) return
    setDeleting(true)
    try {
      await client.delete(`/zones/${zone.id}`)
      removeZone(zone.id)
      onClose()
    } catch (e) {
      setErr(parseApiError(e, 'Xóa thất bại.'))
      setDeleting(false)
    }
  }

  const color = ZONE_STATUS_COLOR[zone.status] ?? '#9CA3AF'
  const tabs: { key: PanelTab; label: string }[] = [
    { key: 'detail', label: 'Chi tiết' },
    { key: 'comments', label: 'Bình luận' },
    { key: 'history', label: 'Lịch sử' },
  ]

  const fieldCls = 'w-full rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-sm text-[#0F172A] transition focus:border-[#FF7F29] focus:outline-none focus:ring-2 focus:ring-[#FF7F29]/20'

  const saveToast =
    saveToastVisible && typeof document !== 'undefined'
      ? createPortal(
          <div
            role="status"
            aria-live="polite"
            className="pointer-events-none fixed bottom-8 left-1/2 z-[10050] flex max-w-[min(100vw-2rem,24rem)] -translate-x-1/2"
          >
            <div className="pointer-events-auto flex items-start gap-3 rounded-2xl border border-emerald-200 bg-white px-5 py-4 shadow-[0_12px_40px_-8px_rgba(15,23,42,0.28)]">
              <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600" aria-hidden />
              <div>
                <p className="text-sm font-semibold text-[#0F172A]">Đã lưu thành công</p>
                <p className="mt-0.5 text-xs leading-relaxed text-[#64748B]">
                  Trạng thái và tiến độ khu vực đã được cập nhật trên bản vẽ.
                </p>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null

  return (
    <div>
      {saveToast}
      {/* Zone header */}
      <div className="flex items-center gap-2.5 bg-[#F8FAFC] px-3 py-2.5">
        <div className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[#0F172A] leading-snug">{zone.name}</p>
          <p className="text-[10px] text-[#94A3B8]">{zone.zone_code}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#E2E8F0] text-xs">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`flex-1 cursor-pointer py-2.5 font-medium transition-all duration-150 ${
              tab === t.key
                ? 'border-b-2 border-[#FF7F29] text-[#FF7F29]'
                : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'detail' ? (
        <div className="space-y-3 p-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#64748B]">Trạng thái</label>
            <select className={fieldCls} value={status}
              onChange={(e) => setStatus(e.target.value as Zone['status'])}>
              {ZONE_STATUS.map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 flex justify-between text-xs font-medium text-[#64748B]">
              <span>Tiến độ</span>
              <span className="font-bold text-[#FF7F29]">{pct}%</span>
            </label>
            <input type="range" min={0} max={100} value={pct}
              onChange={(e) => setPct(Number(e.target.value))}
              className="w-full accent-[#FF7F29]" />
          </div>

          {/* Giao cho: SPEC PATCH-07 — chỉ thành viên dự án (FK); nhãn assignee + hiển thị */}
          {isPM ? (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#64748B]">
                Giao cho (thành viên dự án)
              </label>
              <select
                className={fieldCls}
                value={assignedUserId ?? ''}
                onChange={(e) => setAssignedUserId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">— Chưa giao —</option>
                {members.map((m) => (
                  <option key={m.user.id} value={m.user.id}>
                    {m.user.name}
                    {m.role === 'field_team' ? '' : ` (${m.role === 'project_manager' ? 'PM' : m.role})`}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] leading-snug text-[#94A3B8]">
                Chọn người trong dự án để gán quyền theo zone. Sau khi lưu, tên hiển thị cập nhật theo SPEC.
              </p>
            </div>
          ) : (
            <div>
              <p className="mb-0.5 text-xs font-medium text-[#64748B]">Giao cho</p>
              <p className={`text-sm ${assigneeDisplay ? 'text-[#0F172A]' : 'text-[#94A3B8]'}`}>
                {assigneeDisplay || 'Chưa giao'}
              </p>
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#64748B]">Deadline</label>
            <input type="date" className={fieldCls}
              value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#64748B]">Ghi chú</label>
            <textarea className={fieldCls}
              rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          {err ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-2 text-xs text-red-700">{err}</div>
          ) : null}

          <div className="flex gap-2">
            <button type="button" onClick={() => void save()} disabled={saving}
              className="flex-1 cursor-pointer rounded-xl bg-[#FF7F29] py-2 text-sm font-semibold text-white transition hover:bg-[#E5691D] disabled:opacity-60">
              {saving ? 'Đang lưu...' : 'Lưu'}
            </button>
            {isPM ? (
              <button type="button" onClick={() => void del()} disabled={deleting}
                className="cursor-pointer rounded-xl border border-red-200 px-3 py-2 text-sm text-red-500 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-60">
                Xóa
              </button>
            ) : null}
          </div>
        </div>
      ) : tab === 'comments' ? (
        <CommentsTab zone={zone} isPM={isPM} />
      ) : (
        <HistoryTab zone={zone} isPM={isPM} layerId={layerId} />
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CanvasEditor() {
  const { id: projectId, layerId } = useParams<{ id: string; layerId: string }>()
  const { user, hasProjectRole } = useAuthStore()
  const polygonFabricRef = useRef<FabricCanvasHandle>(null)
  const [pdfMarquee, setPdfMarquee] = useState(false)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [pdfMapEl, setPdfMapEl] = useState<HTMLElement | null>(null)
  const [pdfMarqueeKey, setPdfMarqueeKey] = useState(0)

  const [layer, setLayer] = useState<LayerInfo | null>(null)
  const [layerError, setLayerError] = useState<string | null>(null)

  // Draw mode toolbar
  const [drawMode, setDrawMode] = useState<CanvasDrawMode>('select')
  const [vertexEditZoneId, setVertexEditZoneId] = useState<number | null>(null)

  // Pending geometry after drawing, waiting for zone name input
  const [pendingGeometry, setPendingGeometry] = useState<Geometry | null>(null)
  const [creatingZone, setCreatingZone] = useState(false)

  const zones = useCanvasStore((s) => s.zones)
  const selectedZoneId = useCanvasStore((s) => s.selectedZoneId)
  const filterStatus = useCanvasStore((s) => s.filterStatus)
  const lastSyncAt = useCanvasStore((s) => s.lastSyncAt)
  const { fetchZonesAndMarks, syncSince, addZone, selectZone, setFilterStatus, reset, updateZone } =
    useCanvasStore()

  const layerIdNum = Number(layerId)
  const projectIdNum = Number(projectId)

  // Load layer + zones
  useEffect(() => {
    if (!layerIdNum) return
    reset()
    const load = async () => {
      try {
        const resp = (await client.get(`/layers/${layerIdNum}`)) as { data: ApiResponse<LayerInfo> }
        setLayer(resp.data.data)
      } catch (err) {
        setLayerError(parseApiError(err, 'Không tải được layer.'))
      }
    }
    void load()
    void fetchZonesAndMarks(layerIdNum)
  }, [layerIdNum, fetchZonesAndMarks, reset])

  // Poll sync 30s
  useEffect(() => {
    if (!layerIdNum) return
    const id = setInterval(() => {
      if (lastSyncAt) void syncSince(layerIdNum, lastSyncAt)
    }, 30_000)
    return () => clearInterval(id)
  }, [layerIdNum, lastSyncAt, syncSince])

  // Reset draw mode when layer changes
  useEffect(() => { setDrawMode('select') }, [layerIdNum])

  useEffect(() => {
    if (drawMode !== 'select') setVertexEditZoneId(null)
  }, [drawMode])

  // Handle zone draw completion → show modal
  const handleDrawComplete = (geometry: Geometry) => {
    setPendingGeometry(geometry)
    setDrawMode('select') // switch back to select while modal is open
  }

  const handleZoneGeometryCommit = useCallback(
    async (zoneId: number, geometry: Geometry) => {
      const z = useCanvasStore.getState().zones.find((zz) => zz.id === zoneId)
      if (!z) return
      try {
        const resp = (await client.put(`/zones/${zoneId}`, {
          name: z.name,
          completion_pct: z.completion_pct,
          notes: z.notes,
          deadline: z.deadline,
          assigned_user_id: z.assigned_user_id,
          geometry_pct: geometryToApiPolygon(geometry),
        })) as { data: ApiResponse<Zone> }
        updateZone(resp.data.data)
      } catch (e) {
        alert(parseApiError(e, 'Không lưu được hình vùng.'))
      }
    },
    [updateZone],
  )

  // Create zone via API
  const handleZoneCreate = async (formData: {
    name: string; deadline: string; tasks: string; notes: string
  }) => {
    if (!pendingGeometry) return
    setCreatingZone(true)
    try {
      const resp = (await client.post(`/layers/${layerIdNum}/zones`, {
        name: formData.name,
        geometry_pct: geometryToApiPolygon(pendingGeometry),
        deadline: formData.deadline || null,
        tasks: formData.tasks || null,
        notes: formData.notes || null,
      })) as { data: ApiResponse<Zone> }
      addZone(resp.data.data)
      setPendingGeometry(null)
    } finally {
      setCreatingZone(false)
    }
  }

  const [sidebarOpen, setSidebarOpen] = useState(false)

  const selectedZone = selectedZoneId != null ? zones.find((z) => z.id === selectedZoneId) : null
  const visibleZones = filterStatus ? zones.filter((z) => z.status === filterStatus) : zones

  const layerReady = layer?.status === 'ready'
  const widthPx = layer?.width_px ?? 2480
  const heightPx = layer?.height_px ?? 3508

  const canExportPdf = hasProjectRole(projectIdNum, ['project_manager', 'admin'])
  const canEditZoneGeometry = hasProjectRole(projectIdNum, ['project_manager', 'admin'])

  useLayoutEffect(() => {
    if (!pdfMarquee) {
      setPdfMapEl(null)
      return
    }
    const fc = polygonFabricRef.current?.getFabric()
    const el = (fc as unknown as { lowerCanvasEl?: HTMLElement })?.lowerCanvasEl ?? null
    setPdfMapEl(el)
  }, [pdfMarquee, layerReady, widthPx, heightPx])

  const runLayerPdf = async (crop?: PdfCropRect) => {
    const fc = polygonFabricRef.current?.getFabric() ?? null
    setPdfBusy(true)
    try {
      const name =
        crop != null
          ? `layer_${layerIdNum}_vung_chon.pdf`
          : `layer_${layerIdNum}_toan_bo.pdf`
      await exportLayerPdf(layerIdNum, widthPx, heightPx, fc, name, crop)
    } catch (err) {
      alert(parseApiError(err, 'Xuất PDF thất bại.'))
    } finally {
      setPdfBusy(false)
      setPdfMarquee(false)
    }
  }

  if (layerError) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-red-600">{layerError}</p>
      </div>
    )
  }

  return (
    <>
      {/* Zone create modal */}
      {pendingGeometry ? (
        <ZoneCreateModal
          onSave={handleZoneCreate}
          onCancel={() => setPendingGeometry(null)}
          loading={creatingZone}
        />
      ) : null}

      <div
        style={{ height: 'calc(100vh - 56px)', display: 'flex', flexDirection: 'column' }}
        className="overflow-hidden"
      >
        {/* Context bar / Breadcrumb */}
        <div className="flex items-center gap-2 border-b border-[#E2E8F0] bg-white px-4 py-2 text-sm">
          <Link
            to={`/projects/${projectIdNum}`}
            className="flex cursor-pointer items-center gap-1 text-[#64748B] transition hover:text-[#FF7F29]"
          >
            <ChevronLeft size={15} />
            Dự án
          </Link>
          <span className="text-[#CBD5E1]">/</span>
          <span className="truncate font-medium text-[#0F172A]">{layer?.name ?? `Layer #${layerIdNum}`}</span>
          {!layerReady && layer ? (
            <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
              {layer.status === 'processing' ? 'Đang xử lý...' : layer.status}
            </span>
          ) : null}
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2 shrink-0">
            {canExportPdf && layerReady ? (
              <>
                <button
                  type="button"
                  disabled={pdfBusy || pdfMarquee}
                  onClick={() => void runLayerPdf()}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[#FF7F29]/50 bg-[#FFF3E8] px-2.5 py-1 text-xs font-medium text-[#C2410C] transition hover:bg-[#FFEDD5] disabled:opacity-50"
                >
                  <FileDown className="h-3.5 w-3.5" />
                  {pdfBusy && !pdfMarquee ? 'PDF…' : 'PDF toàn bộ'}
                </button>
                <button
                  type="button"
                  disabled={pdfBusy}
                  onClick={() => {
                    setDrawMode('select')
                    setPdfMarqueeKey((k) => k + 1)
                    setPdfMarquee(true)
                  }}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1 text-xs font-medium text-[#64748B] transition hover:bg-[#F8FAFC] disabled:opacity-50"
                >
                  <FileDown className="h-3.5 w-3.5" />
                  PDF vùng chọn
                </button>
              </>
            ) : null}
            <span className="hidden text-xs text-[#94A3B8] sm:inline">
              {zones.length} khu vực
            </span>
            <button
              type="button"
              onClick={() => setSidebarOpen((o) => !o)}
              className="cursor-pointer rounded-lg border border-[#E2E8F0] px-2.5 py-1 text-xs text-[#64748B] transition hover:bg-[#F8FAFC] lg:hidden"
            >
              {sidebarOpen ? '✕ Đóng' : '≡ Khu vực'}
            </button>
          </div>
        </div>

        {/* Main area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Canvas area */}
          <div className="relative flex-1 overflow-hidden">
            {layerReady ? (
              <CanvasWrapper widthPx={widthPx} heightPx={heightPx}>
                <TileLayer layerId={layerIdNum} widthPx={widthPx} heightPx={heightPx} />
                <PolygonLayer
                  ref={polygonFabricRef}
                  widthPx={widthPx}
                  heightPx={heightPx}
                  canvasMode="editor"
                  currentUserId={user?.id}
                  drawMode={drawMode !== 'select'}
                  drawShape={drawMode === 'draw_rect' ? 'rect' : 'polygon'}
                  onDrawComplete={handleDrawComplete}
                  enableZoneDrag={canEditZoneGeometry}
                  vertexEditZoneId={vertexEditZoneId}
                  onVertexEditZoneChange={setVertexEditZoneId}
                  onZoneGeometryCommit={handleZoneGeometryCommit}
                />
              </CanvasWrapper>
            ) : (
              <div className="flex h-full items-center justify-center bg-neutral-800 text-neutral-400">
                {layer?.status === 'processing'
                  ? 'Đang xử lý bản vẽ...'
                  : layer
                    ? `Layer chưa sẵn sàng (${layer.status})`
                    : 'Đang tải...'}
              </div>
            )}

            {pdfMarquee && layerReady ? (
              <ExportMarqueeOverlay
                key={pdfMarqueeKey}
                active={pdfMarquee}
                widthPx={widthPx}
                heightPx={heightPx}
                mapTargetEl={pdfMapEl}
                onCancel={() => setPdfMarquee(false)}
                onComplete={(crop) => void runLayerPdf(crop)}
              />
            ) : null}

            {/* Draw toolbar — desktop only */}
            <div className="absolute left-4 top-4 z-10 hidden lg:block">
              <CanvasToolbar mode={drawMode} onModeChange={setDrawMode} />
            </div>

            {layerReady && vertexEditZoneId != null && canEditZoneGeometry ? (
              <div
                role="toolbar"
                aria-label="Sửa hình vùng"
                className="absolute left-1/2 top-16 z-20 flex max-w-[min(100vw-2rem,28rem)] -translate-x-1/2 flex-col gap-2 rounded-xl border border-[#E2E8F0] bg-white/95 px-4 py-2.5 shadow-lg backdrop-blur-sm"
              >
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <span className="text-xs font-semibold text-[#0F172A]">Sửa đỉnh vùng</span>
                  <button
                    type="button"
                    onClick={() => polygonFabricRef.current?.commitVertexEdit?.()}
                    className="cursor-pointer rounded-lg bg-[#FF7F29] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#E5691D]"
                  >
                    Lưu hình
                  </button>
                  <button
                    type="button"
                    onClick={() => polygonFabricRef.current?.cancelVertexEdit?.()}
                    className="cursor-pointer rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs font-medium text-[#64748B] transition hover:bg-[#F8FAFC]"
                  >
                    Hủy
                  </button>
                </div>
                <p className="text-center text-[10px] leading-snug text-[#64748B]">
                  Đỉnh đỏ kéo • <strong className="font-semibold text-[#475569]">Chấm xanh: double-click</strong> để
                  chèn đỉnh trên cạnh (click một lần / click ngoài polygon không chèn đỉnh) • Chuột phải đỉnh đỏ: xóa
                  • Ctrl+Z / Ctrl+Shift+Z • Lưu hình / Hủy / Esc
                </p>
              </div>
            ) : null}

            {layerReady && drawMode === 'select' && canEditZoneGeometry && vertexEditZoneId == null ? (
              <div className="absolute left-1/2 top-4 z-10 hidden max-w-md -translate-x-1/2 rounded-lg border border-[#E2E8F0] bg-white/90 px-3 py-1.5 text-center text-[10px] text-[#64748B] shadow-sm backdrop-blur-sm lg:block pointer-events-none">
                Double-click vùng: sửa đỉnh • Kéo vùng: di chuyển toàn bộ (lưu sau khi thả)
              </div>
            ) : null}

            {/* Hint when in draw mode */}
            {drawMode !== 'select' ? (
              <div className="absolute left-1/2 top-4 z-10 hidden -translate-x-1/2 rounded-xl border border-[#E2E8F0] bg-white/95 px-4 py-2 text-xs shadow-md backdrop-blur-sm lg:block">
                {drawMode === 'draw_polygon'
                  ? 'Click để đặt điểm • Double-click để kết thúc (min 3 điểm)'
                  : 'Click và kéo để vẽ hình chữ nhật'}
              </div>
            ) : null}

            {/* Filter chips */}
            <div className="absolute bottom-16 left-4 z-10 flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setFilterStatus(null)}
                className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-medium shadow-sm backdrop-blur-sm transition-all duration-150 ${
                  !filterStatus
                    ? 'border-[#0F172A] bg-[#0F172A] text-white'
                    : 'border-[#E2E8F0] bg-white/90 text-[#64748B] hover:bg-white'
                }`}
              >
                Tất cả
              </button>
              {ZONE_STATUS.map((s) => (
                <button
                  key={s}
                  type="button"
                  style={filterStatus === s
                    ? { backgroundColor: ZONE_STATUS_COLOR[s], color: '#fff', borderColor: ZONE_STATUS_COLOR[s] }
                    : { borderColor: ZONE_STATUS_COLOR[s] + '80' }
                  }
                  className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-medium shadow-sm backdrop-blur-sm transition-all duration-150 ${
                    filterStatus === s ? '' : 'bg-white/90 hover:bg-white'
                  }`}
                  onClick={() => setFilterStatus(filterStatus === s ? null : s)}
                >
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>

            {/* ZoomControls */}
            <div className="absolute bottom-4 left-4 z-10">
              <ZoomControls />
            </div>

            {/* Legend */}
            <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-1.5 rounded-xl border border-[#E2E8F0] bg-white/95 p-2.5 shadow-sm backdrop-blur-sm text-xs">
              {ZONE_STATUS.map((s) => (
                <div key={s} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: ZONE_STATUS_COLOR[s] }} />
                  <span className="text-[#64748B]">{STATUS_LABELS[s]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Sidebar backdrop — mobile/tablet */}
          {sidebarOpen ? (
            <div
              className="fixed inset-0 z-10 bg-black/40 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          ) : null}

          {/* Sidebar */}
          <aside
            className={[
              'flex w-72 flex-col border-l border-[#E2E8F0] bg-white',
              'lg:relative lg:flex lg:w-80',
              sidebarOpen ? 'fixed inset-y-0 right-0 z-20 flex' : 'hidden',
            ].join(' ')}
            style={sidebarOpen ? { top: 'calc(56px + 41px)' } : {}}
          >
            {/* Sidebar header */}
            <div className="flex items-center justify-between border-b border-[#E2E8F0] px-4 py-3">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-[#0F172A]">Khu vực</p>
                <span className="rounded-full bg-[#F1F5F9] px-2 py-0.5 text-xs font-medium text-[#64748B]">
                  {visibleZones.length}/{zones.length}
                </span>
              </div>
            </div>

            {/* Zone list */}
            <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
              {visibleZones.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <p className="text-sm text-[#64748B]">
                    {zones.length === 0
                      ? 'Chưa có khu vực. Dùng toolbar để vẽ zone.'
                      : 'Không có zone phù hợp bộ lọc.'}
                  </p>
                </div>
              ) : (
                <ul className="space-y-0.5">
                  {visibleZones.map((zone) => {
                    const color = ZONE_STATUS_COLOR[zone.status] ?? '#9CA3AF'
                    const isSelected = zone.id === selectedZoneId
                    return (
                      <li key={zone.id}>
                        <button
                          type="button"
                          className={`flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-all duration-150 ${
                            isSelected
                              ? 'border-l-2 border-l-[#FF7F29] bg-[#FFF3E8] font-medium text-[#0F172A]'
                              : 'text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0F172A]'
                          }`}
                          onClick={() => {
                            selectZone(isSelected ? null : zone.id)
                            if (!isSelected) setSidebarOpen(true)
                          }}
                        >
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                          <span className="flex-1 truncate">{zone.name}</span>
                          <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-xs ${
                            isSelected ? 'bg-[#FF7F29]/15 text-[#FF7F29]' : 'bg-[#F1F5F9] text-[#94A3B8]'
                          }`}>
                            {zone.completion_pct}%
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            {selectedZone ? (
              <div className="border-t border-[#E2E8F0] overflow-y-auto">
                <ZoneDetailPanel zone={selectedZone} layerId={layerIdNum} projectId={projectIdNum} onClose={() => selectZone(null)} />
              </div>
            ) : null}
          </aside>
        </div>
      </div>
    </>
  )
}
