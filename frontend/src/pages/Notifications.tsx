import { useEffect, useState } from 'react'
import { Bell, BellOff, CheckCheck, Clock } from 'lucide-react'

import client from '@/api/client'

// ─── Types ───────────────────────────────────────────────────────────────────

type Notification = {
  id: number
  type: string
  title: string
  body: string | null
  data: Record<string, unknown> | null
  read_at: string | null
  created_at: string
}

type ApiResponse<T> = { success: boolean; data: T }

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseApiError(err: unknown, fallback: string): string {
  if (typeof err === 'object' && err !== null && 'response' in err) {
    const msg = (err as { response?: { data?: { error?: { message?: unknown } } } }).response
      ?.data?.error?.message
    if (typeof msg === 'string' && msg) return msg
  }
  return fallback
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'Vừa xong'
  if (mins < 60) return `${mins} phút trước`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} giờ trước`
  return new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
}

function notifIcon(type: string) {
  if (type.includes('deadline') || type.includes('overdue')) {
    return <Clock size={16} className="text-amber-500" />
  }
  return <Bell size={16} className="text-[#FF7F29]" />
}

// ─── Notifications page ───────────────────────────────────────────────────────

export default function Notifications() {
  const [items, setItems] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [markingAll, setMarkingAll] = useState(false)

  const unreadCount = items.filter((n) => !n.read_at).length

  const load = async () => {
    setLoading(true); setErr(null)
    try {
      const resp = (await client.get('/notifications')) as { data: ApiResponse<Notification[]> }
      setItems(resp.data.data ?? [])
    } catch (e) {
      setErr(parseApiError(e, 'Không tải được thông báo.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const markRead = async (id: number) => {
    try {
      await client.patch(`/notifications/${id}/read`)
      setItems((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)),
      )
    } catch {
      // silent — optimistic already applied
    }
  }

  const markAll = async () => {
    setMarkingAll(true)
    try {
      await client.patch('/notifications/read-all')
      const now = new Date().toISOString()
      setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? now })))
    } catch (e) {
      setErr(parseApiError(e, 'Thao tác thất bại.'))
    } finally {
      setMarkingAll(false)
    }
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">Thông báo</h1>
          {unreadCount > 0 ? (
            <p className="mt-0.5 text-sm text-[#64748B]">
              <span className="font-semibold text-[#FF7F29]">{unreadCount}</span> chưa đọc
            </p>
          ) : null}
        </div>
        {unreadCount > 0 ? (
          <button
            type="button"
            disabled={markingAll}
            onClick={() => void markAll()}
            className="flex cursor-pointer items-center gap-2 rounded-xl border border-[#E2E8F0] px-4 py-2 text-sm font-medium text-[#FF7F29] transition-all duration-150 hover:bg-[#FFF3E8] disabled:opacity-60"
          >
            <CheckCheck size={15} />
            {markingAll ? 'Đang xử lý...' : 'Đọc tất cả'}
          </button>
        ) : null}
      </div>

      {err ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{err}</div>
      ) : null}

      {/* Loading skeletons */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl border border-[#E2E8F0] bg-[#F8FAFC]" />
          ))}
        </div>
      ) : items.length === 0 ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F8FAFC]">
            <BellOff size={28} className="text-[#CBD5E1]" />
          </div>
          <p className="font-semibold text-[#0F172A]">Không có thông báo</p>
          <p className="mt-1 text-sm text-[#64748B]">Bạn đã xem hết tất cả thông báo.</p>
        </div>
      ) : (
        /* Notification list */
        <ul className="space-y-2">
          {items.map((n) => {
            const isUnread = !n.read_at
            return (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => { if (isUnread) void markRead(n.id) }}
                  className={`w-full cursor-pointer rounded-xl border p-4 text-left transition-all duration-150 ${
                    isUnread
                      ? 'border-[#FF7F29]/30 bg-[#FFF3E8] hover:border-[#FF7F29]/50 hover:shadow-sm'
                      : 'border-[#E2E8F0] bg-white hover:bg-[#F8FAFC]'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                      isUnread ? 'bg-[#FF7F29]/15' : 'bg-[#F1F5F9]'
                    }`}>
                      {notifIcon(n.type)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className={`text-sm leading-snug ${isUnread ? 'font-semibold text-[#0F172A]' : 'font-medium text-[#64748B]'}`}>
                        {n.title}
                      </p>
                      {n.body ? (
                        <p className="mt-0.5 line-clamp-2 text-xs text-[#94A3B8]">{n.body}</p>
                      ) : null}
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <span className="whitespace-nowrap text-xs text-[#94A3B8]">
                        {timeAgo(n.created_at)}
                      </span>
                      {isUnread ? (
                        <span className="h-2 w-2 rounded-full bg-[#FF7F29]" />
                      ) : null}
                    </div>
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}
