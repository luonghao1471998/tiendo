/**
 * Định dạng hiển thị activity log (zone + mark) — đồng bộ với backend activity_logs.changes.
 */

export type ActivityLogEntry = {
  id: number
  target_type?: string
  target_id?: number
  action: 'created' | 'updated' | 'status_changed' | 'deleted' | 'restored'
  user_name: string
  changes: Record<string, unknown> | null
  snapshot_before: Record<string, unknown> | null
  restored_from_log_id: number | null
  created_at: string
}

const ZONE_STATUS_VN: Record<string, string> = {
  not_started: 'Chưa bắt đầu',
  in_progress: 'Đang thi công',
  completed: 'Hoàn thành',
  delayed: 'Trễ',
  paused: 'Tạm dừng',
}

const MARK_STATUS_VN: Record<string, string> = {
  in_progress: 'Cam — đang thi công',
  completed: 'Xanh — hoàn thành',
}

function zoneStatusLabel(v: unknown): string {
  if (typeof v !== 'string') return String(v ?? '—')
  return ZONE_STATUS_VN[v] ?? v
}

function markStatusLabel(v: unknown): string {
  if (typeof v !== 'string') return String(v ?? '—')
  return MARK_STATUS_VN[v] ?? v
}

function isFromTo(v: unknown): v is { from: unknown; to: unknown } {
  return (
    typeof v === 'object' &&
    v !== null &&
    'from' in v &&
    'to' in v &&
    !Array.isArray(v)
  )
}

function fmtPct(v: unknown): string {
  if (typeof v === 'number' && Number.isFinite(v)) return `${Math.round(v)}%`
  if (typeof v === 'string' && v !== '') return `${v}%`
  return String(v ?? '—')
}

function fmtDate(v: unknown): string {
  if (v == null || v === '') return '—'
  const s = String(v)
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function fmtText(v: unknown, max = 120): string {
  const s = String(v ?? '')
  if (s.length <= max) return s
  return `${s.slice(0, max)}…`
}

/** ISO / DB datetime → `YYYY-MM-DD HH:mm:ss` (giờ local) — không hiện mũi tên from→to cho updated_at. */
function fmtDateTimeCompact(v: unknown): string {
  if (v == null || v === '') return '—'
  const d = new Date(String(v))
  if (Number.isNaN(d.getTime())) return String(v)
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const da = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  const s = String(d.getSeconds()).padStart(2, '0')
  return `${y}-${mo}-${da} ${h}:${mi}:${s}`
}

const AVATAR_BG = ['#2563EB', '#7C3AED', '#D97706', '#059669', '#DC2626', '#DB2777', '#0D9488']

export function activityAvatarColor(userName: string): string {
  let h = 0
  for (let i = 0; i < userName.length; i++) {
    h = userName.charCodeAt(i) + ((h << 5) - h)
  }
  return AVATAR_BG[Math.abs(h) % AVATAR_BG.length]
}

export function activityUserInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** Thời gian tương đối kiểu dashboard (gần với mockup). */
export function formatRelativeTimeVi(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const now = Date.now()
  const diffMs = now - d.getTime()
  const sec = Math.floor(diffMs / 1000)
  if (sec < 45) return 'Vừa xong'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} phút trước`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} giờ trước`
  const startToday = new Date()
  startToday.setHours(0, 0, 0, 0)
  const startYesterday = new Date(startToday)
  startYesterday.setDate(startYesterday.getDate() - 1)
  if (d >= startYesterday && d < startToday) {
    return `Hôm qua, ${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`
  }
  const days = Math.floor(hr / 24)
  if (days < 7) return `${days} ngày trước`
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export type ActivityVisualLine = {
  id: string
  kind: 'status_arrow' | 'text' | 'pct_arrow'
  left: string
  arrow?: string
  right?: string
  /** Gợi ý màu nhấn (trạng thái / tiến độ) */
  accent?: 'neutral' | 'amber' | 'emerald' | 'rose'
}

export type ActivityDescription = {
  scope: 'zone' | 'mark'
  /** Câu tóm tắt hành động (không gồm tên user) */
  summary: string
  /** Dòng chi tiết (mũi tên trạng thái, %, v.v.) */
  lines: ActivityVisualLine[]
}

function pushChangeLines(
  changes: Record<string, unknown> | null,
  scope: 'zone' | 'mark',
  lines: ActivityVisualLine[],
): void {
  if (!changes) return

  if (typeof changes.note === 'string' && changes.note.trim() !== '') {
    lines.push({
      id: 'note-transition',
      kind: 'text',
      left: `Ghi chú: ${fmtText(changes.note, 200)}`,
      accent: 'neutral',
    })
  }

  const entries = Object.entries(changes).filter(([k]) => k !== 'note')

  for (const [key, raw] of entries) {
    if (key === 'status' && isFromTo(raw)) {
      lines.push({
        id: `status-${lines.length}`,
        kind: 'status_arrow',
        left: scope === 'zone' ? zoneStatusLabel(raw.from) : markStatusLabel(raw.from),
        arrow: '→',
        right: scope === 'zone' ? zoneStatusLabel(raw.to) : markStatusLabel(raw.to),
        accent: 'amber',
      })
      continue
    }

    if (key === 'completion_pct' && isFromTo(raw)) {
      lines.push({
        id: `pct-${lines.length}`,
        kind: 'pct_arrow',
        left: fmtPct(raw.from),
        arrow: '→',
        right: fmtPct(raw.to),
        accent: 'emerald',
      })
      continue
    }

    if (key === 'deadline' && isFromTo(raw)) {
      lines.push({
        id: `deadline-${lines.length}`,
        kind: 'text',
        left: `Deadline: ${fmtDate(raw.from)} → ${fmtDate(raw.to)}`,
        accent: 'neutral',
      })
      continue
    }

    if (key === 'assignee' && isFromTo(raw)) {
      lines.push({
        id: `assignee-${lines.length}`,
        kind: 'text',
        left: `Nhãn phụ trách: ${fmtText(raw.from, 80) || '—'} → ${fmtText(raw.to, 80) || '—'}`,
        accent: 'neutral',
      })
      continue
    }

    if (key === 'assigned_user_id' && isFromTo(raw)) {
      lines.push({
        id: `au-${lines.length}`,
        kind: 'text',
        left: `Người được giao (ID): ${String(raw.from ?? '—')} → ${String(raw.to ?? '—')}`,
        accent: 'neutral',
      })
      continue
    }

    if (key === 'name' && isFromTo(raw)) {
      lines.push({
        id: `name-${lines.length}`,
        kind: 'text',
        left: `Tên khu: ${fmtText(raw.from, 80)} → ${fmtText(raw.to, 80)}`,
        accent: 'neutral',
      })
      continue
    }

    if (key === 'notes' && isFromTo(raw)) {
      lines.push({
        id: `notes-${lines.length}`,
        kind: 'text',
        left: `Ghi chú khu: ${fmtText(raw.from, 100)} → ${fmtText(raw.to, 100)}`,
        accent: 'neutral',
      })
      continue
    }

    if (key === 'tasks' && isFromTo(raw)) {
      lines.push({
        id: `tasks-${lines.length}`,
        kind: 'text',
        left: `Công việc: ${fmtText(raw.from, 100)} → ${fmtText(raw.to, 100)}`,
        accent: 'neutral',
      })
      continue
    }

    if (key === 'geometry_pct' && isFromTo(raw)) {
      lines.push({
        id: `geo-${lines.length}`,
        kind: 'text',
        left: 'Ranh giới / hình dạng vùng đã được cập nhật.',
        accent: 'neutral',
      })
      continue
    }

    if (key === 'updated_at' && isFromTo(raw)) {
      lines.push({
        id: `updated-at-${lines.length}`,
        kind: 'text',
        left: `Cập nhật: ${fmtDateTimeCompact(raw.to)}`,
        accent: 'neutral',
      })
      continue
    }

    if (isFromTo(raw)) {
      lines.push({
        id: `misc-${key}-${lines.length}`,
        kind: 'text',
        left: `${key}: ${fmtText(raw.from, 60)} → ${fmtText(raw.to, 60)}`,
        accent: 'neutral',
      })
    }
  }
}

/**
 * Mô tả một dòng log để render card (tóm tắt + chi tiết có cấu trúc).
 */
export function describeActivityLog(entry: ActivityLogEntry, zoneName: string): ActivityDescription {
  const scope = entry.target_type === 'mark' ? 'mark' : 'zone'
  const zq = `«${zoneName}»`
  const lines: ActivityVisualLine[] = []

  if (scope === 'zone') {
    switch (entry.action) {
      case 'created':
        return {
          scope: 'zone',
          summary: `đã tạo khu vực ${zq}`,
          lines: [],
        }
      case 'deleted':
        return {
          scope: 'zone',
          summary: `đã xóa khu vực ${zq}`,
          lines: [],
        }
      case 'restored':
        return {
          scope: 'zone',
          summary: `đã hoàn tác thay đổi (khôi phục trạng thái trước đó) cho ${zq}`,
          lines: [],
        }
      case 'status_changed': {
        pushChangeLines(entry.changes, 'zone', lines)
        return {
          scope: 'zone',
          summary: `đã đổi trạng thái khu vực ${zq}`,
          lines,
        }
      }
      case 'updated': {
        pushChangeLines(entry.changes, 'zone', lines)
        return {
          scope: 'zone',
          summary: `đã cập nhật khu vực ${zq}`,
          lines,
        }
      }
      default:
        return { scope: 'zone', summary: `đã thao tác trên ${zq}`, lines: [] }
    }
  }

  // mark
  const mid = entry.target_id != null ? `#${entry.target_id}` : ''
  switch (entry.action) {
    case 'created':
      return {
        scope: 'mark',
        summary: `đã tô mark tiến độ mới ${mid ? `(mark ${mid}) ` : ''}trong ${zq}`,
        lines: [],
      }
    case 'deleted':
      return {
        scope: 'mark',
        summary: `đã xóa mark tiến độ ${mid} trong ${zq}`,
        lines: [],
      }
    case 'status_changed': {
      pushChangeLines(entry.changes, 'mark', lines)
      return {
        scope: 'mark',
        summary: `đã đổi trạng thái mark ${mid} tại ${zq}`,
        lines,
      }
    }
    case 'restored':
      return {
        scope: 'mark',
        summary: `đã hoàn tác liên quan tới mark tại ${zq}`,
        lines: [],
      }
    default:
      return {
        scope: 'mark',
        summary: `đã cập nhật mark tại ${zq}`,
        lines: [],
      }
  }
}

export function activityScopeTag(scope: 'zone' | 'mark'): { label: string; className: string } {
  if (scope === 'mark') {
    return {
      label: 'Mark tiến độ',
      className: 'bg-violet-50 text-violet-800 ring-violet-200',
    }
  }
  return {
    label: 'Khu vực',
    className: 'bg-sky-50 text-sky-800 ring-sky-200',
  }
}
