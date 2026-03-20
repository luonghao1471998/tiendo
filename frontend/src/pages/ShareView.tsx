/**
 * ShareView — public route /share/:token
 * GET /api/v1/share/{token} trả về project + layers + zones + marks đã nhúng sẵn.
 * Không cần gọi thêm API nào khác.
 */
import axios from 'axios'
import { useEffect, useRef, useState } from 'react'
import { fabric } from 'fabric'
import { useParams } from 'react-router-dom'

import { ZONE_STATUS, ZONE_STATUS_COLOR, MARK_STATUS_COLOR } from '@/lib/constants'
import type { Zone, Mark, Geometry } from '@/stores/canvasStore'

// ─── Types phản ánh đúng response API ────────────────────────────────────────

type RawPoint = { x: number; y: number }

type RawGeometry = {
  type: 'polygon' | 'rect'
  points?: RawPoint[]
  x?: number; y?: number; width?: number; height?: number
}

type RawMark = {
  id: number
  zone_id: number
  status: string
  geometry_pct: RawGeometry
  painted_by: number | null
  updated_at: string | null
}

type RawZone = {
  id: number
  zone_code: string
  name: string
  status: string
  completion_pct: number
  geometry_pct: RawGeometry
  assignee: string | null
  assigned_user_id: number | null
  deadline: string | null
  tasks: string | null
  notes: string | null
  updated_at: string | null
  marks: RawMark[]
}

type ShareLayer = {
  id: number
  name: string
  status: 'pending' | 'processing' | 'ready' | 'error'
  width_px: number | null
  height_px: number | null
  master_layer: { id: number; name: string; code: string; sort_order?: number }
  zones: RawZone[]
}

type ShareData = {
  share_link: { token: string; expires_at: string; role: string }
  project: { id: number; name: string; code: string; description: string | null; address: string | null }
  layers: ShareLayer[]
}

// ─── Geometry normalize: API {x,y}[] → frontend [x,y][] ─────────────────────

function normalizeGeometry(raw: RawGeometry): Geometry {
  if (raw.type === 'polygon' && raw.points) {
    return { type: 'polygon', points: raw.points.map((p) => [p.x, p.y] as [number, number]) }
  }
  if (raw.type === 'rect') {
    return { type: 'rect', x: raw.x, y: raw.y, width: raw.width, height: raw.height }
  }
  return { type: 'polygon', points: [] }
}

function normalizeZone(raw: RawZone): Zone {
  return {
    id: raw.id,
    zone_code: raw.zone_code,
    name: raw.name,
    status: raw.status as Zone['status'],
    completion_pct: raw.completion_pct,
    geometry_pct: normalizeGeometry(raw.geometry_pct),
    assignee: raw.assignee,
    assigned_user_id: raw.assigned_user_id,
    deadline: raw.deadline,
    tasks: raw.tasks,
    notes: raw.notes,
    updated_at: raw.updated_at,
  }
}

function normalizeMark(raw: RawMark): Mark {
  return {
    id: raw.id,
    zone_id: raw.zone_id,
    status: raw.status as Mark['status'],
    geometry_pct: normalizeGeometry(raw.geometry_pct),
    painted_by: raw.painted_by,
    updated_at: raw.updated_at,
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const publicClient = axios.create({
  baseURL: (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api/v1',
})

function parseApiError(err: unknown, fallback: string): string {
  if (typeof err === 'object' && err !== null && 'response' in err) {
    const msg = (err as { response?: { data?: { error?: { message?: unknown } } } }).response
      ?.data?.error?.message
    if (typeof msg === 'string' && msg) return msg
  }
  return fallback
}

const STATUS_LABELS: Record<string, string> = {
  not_started: 'Chưa bắt đầu',
  in_progress: 'Đang thi công',
  completed: 'Hoàn thành',
  delayed: 'Trễ',
  paused: 'Tạm dừng',
}

function toAbsPoints(geometry: Geometry, w: number, h: number): fabric.Point[] {
  if (geometry.type === 'polygon' && geometry.points) {
    return geometry.points.map(([px, py]) => new fabric.Point(px * w, py * h))
  }
  if (geometry.type === 'rect') {
    const { x = 0, y = 0, width = 0, height = 0 } = geometry
    return [
      new fabric.Point(x * w, y * h),
      new fabric.Point((x + width) * w, y * h),
      new fabric.Point((x + width) * w, (y + height) * h),
      new fabric.Point(x * w, (y + height) * h),
    ]
  }
  return []
}

function centroid(points: fabric.Point[]): { x: number; y: number } {
  const n = points.length
  if (!n) return { x: 0, y: 0 }
  return {
    x: points.reduce((a, p) => a + p.x, 0) / n,
    y: points.reduce((a, p) => a + p.y, 0) / n,
  }
}

function hexWithAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

// ─── ShareZoneInfoPopup ────────────────────────────────────────────────────

function ShareZoneInfoPopup({ zone, onClose }: { zone: Zone; onClose: () => void }) {
  const color = ZONE_STATUS_COLOR[zone.status] ?? '#9CA3AF'
  return (
    <div className="w-60 rounded-xl border bg-white shadow-xl">
      <div className="flex items-center justify-between rounded-t-xl bg-gray-50 px-4 py-2">
        <div className="min-w-0">
          <p className="truncate text-xs text-gray-500">{zone.zone_code}</p>
          <p className="truncate font-semibold text-gray-900">{zone.name}</p>
        </div>
        <button type="button" onClick={onClose}
          className="ml-2 shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100">
          ✕
        </button>
      </div>
      <div className="space-y-2 p-4 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-gray-500">Trạng thái</span>
          <span className="rounded-full px-2 py-0.5 text-xs font-medium text-white"
            style={{ backgroundColor: color }}>
            {STATUS_LABELS[zone.status]}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-500">Tiến độ</span>
          <span className="font-bold">{zone.completion_pct}%</span>
        </div>
        {zone.assignee ? (
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Giao cho</span>
            <span>{zone.assignee}</span>
          </div>
        ) : null}
        {zone.deadline ? (
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Deadline</span>
            <span>{zone.deadline}</span>
          </div>
        ) : null}
        <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-100">
          <div className="h-full rounded-full"
            style={{ width: `${zone.completion_pct}%`, backgroundColor: color }} />
        </div>
      </div>
    </div>
  )
}

// ─── ShareCanvas — nhận zones + marks đã normalize, không gọi API ────────────

interface ShareCanvasProps {
  layerId: number
  widthPx: number
  heightPx: number
  zones: Zone[]
  marks: Mark[]
  filterStatus: string | null
  onZoneClick: (zone: Zone, x: number, y: number) => void
}

function ShareCanvas({ layerId, widthPx, heightPx, zones, marks, filterStatus, onZoneClick }: ShareCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fabricRef = useRef<fabric.Canvas | null>(null)

  // Init fabric canvas — backgroundColor must be empty so tiles show through
  useEffect(() => {
    if (!canvasRef.current) return
    const fc = new fabric.Canvas(canvasRef.current, {
      selection: false,
      renderOnAddRemove: false,
    })
    fc.backgroundColor = ''
    fabricRef.current = fc

    return () => {
      fc.dispose()
      fabricRef.current = null
    }
  }, [])

  // Keep click handler up-to-date with latest zones closure
  useEffect(() => {
    const fc = fabricRef.current
    if (!fc) return
    fc.off('mouse:down')
    fc.on('mouse:down', (e: fabric.IEvent<MouseEvent>) => {
      const target = e.target as (fabric.Object & { data?: { role?: string; id?: number } }) | null
      if (target?.data?.role === 'zone') {
        const zone = zones.find((z) => z.id === target.data!.id)
        if (zone) onZoneClick(zone, e.e.clientX, e.e.clientY)
      }
    })
  }, [zones, onZoneClick])

  // Render zones + marks whenever data changes
  useEffect(() => {
    const fc = fabricRef.current
    if (!fc) return
    fc.clear()

    const visible = filterStatus ? zones.filter((z) => z.status === filterStatus) : zones

    for (const zone of visible) {
      const pts = toAbsPoints(zone.geometry_pct, widthPx, heightPx)
      if (pts.length < 2) continue
      const color = ZONE_STATUS_COLOR[zone.status] ?? '#9CA3AF'

      fc.add(new fabric.Polygon(pts, {
        fill: zone.status === 'not_started' ? 'transparent' : hexWithAlpha(color, 0.15),
        stroke: color,
        strokeWidth: 2,
        selectable: false,
        evented: true,
        hoverCursor: 'pointer',
        data: { role: 'zone', id: zone.id },
      }))

      const c = centroid(pts)
      fc.add(new fabric.Text(zone.zone_code || zone.name, {
        left: c.x,
        top: c.y,
        fontSize: Math.max(10, Math.min(14, widthPx / 80)),
        fill: '#ffffff',
        textAlign: 'center',
        originX: 'center',
        originY: 'center',
        selectable: false,
        evented: false,
        shadow: new fabric.Shadow({ color: 'rgba(0,0,0,0.8)', blur: 4 }),
      }))
    }

    for (const mark of marks) {
      const pts = toAbsPoints(mark.geometry_pct, widthPx, heightPx)
      if (pts.length < 2) continue
      const color = MARK_STATUS_COLOR[mark.status] ?? '#F59E0B'
      fc.add(new fabric.Polygon(pts, {
        fill: hexWithAlpha(color, 0.5),
        stroke: color,
        strokeWidth: 1.5,
        selectable: false,
        evented: false,
      }))
    }

    fc.renderAll()
  }, [zones, marks, filterStatus, widthPx, heightPx])

  // Zoom / pan — wheel + middle-click/alt+drag
  const zoom = useRef(1)
  const panOffset = useRef({ x: 0, y: 0 })
  const isPanning = useRef(false)
  const panStart = useRef({ x: 0, y: 0 })
  const outerRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const applyTransform = () => {
    if (!containerRef.current) return
    containerRef.current.style.transform =
      `translate(-50%, -50%) translate(${panOffset.current.x}px, ${panOffset.current.y}px) scale(${zoom.current})`
  }

  useEffect(() => {
    const el = outerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const delta = e.deltaY < 0 ? 1.1 : 1 / 1.1
      zoom.current = Math.min(Math.max(zoom.current * delta, 0.1), 10)
      applyTransform()
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 1 && !e.altKey) return
    e.preventDefault()
    isPanning.current = true
    panStart.current = { x: e.clientX - panOffset.current.x, y: e.clientY - panOffset.current.y }
  }
  const onMouseMove = (e: React.MouseEvent) => {
    if (!isPanning.current) return
    panOffset.current = { x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y }
    applyTransform()
  }
  const stopPan = () => { isPanning.current = false }

  const TILE = 1024
  const cols = Math.ceil(widthPx / TILE)
  const rows = Math.ceil(heightPx / TILE)

  return (
    <div
      ref={outerRef}
      className="relative overflow-hidden bg-neutral-800"
      style={{ width: '100%', height: '100%' }}
      onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={stopPan} onMouseLeave={stopPan}
    >
      {/* Inner container — centered, sized to layer dimensions, zoom+pan via transform */}
      <div
        ref={containerRef}
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: widthPx,
          height: heightPx,
          transformOrigin: 'center center',
          transform: 'translate(-50%, -50%)',
        }}
      >
        {/* Layer 1: PDF tiles — position absolute, below canvas in stacking order */}
        <div style={{ position: 'absolute', inset: 0, width: widthPx, height: heightPx }}>
          {Array.from({ length: rows }, (_, row) =>
            Array.from({ length: cols }, (_, col) => {
              const left = col * TILE
              const top = row * TILE
              return (
                <img
                  key={`${col}_${row}`}
                  src={`/api/v1/layers/${layerId}/tiles/0/${col}/${row}`}
                  alt=""
                  draggable={false}
                  style={{
                    position: 'absolute',
                    left,
                    top,
                    width: Math.min(TILE, widthPx - left),
                    height: Math.min(TILE, heightPx - top),
                    display: 'block',
                  }}
                />
              )
            }),
          )}
        </div>

        {/* Layer 2: Fabric canvas — position absolute, transparent over tiles.
            Fabric wraps this <canvas> with .canvas-container but tiles div is a sibling
            rendered first, so canvas always appears on top with transparent background. */}
        <canvas
          ref={canvasRef}
          width={widthPx}
          height={heightPx}
          style={{ position: 'absolute', inset: 0 }}
        />
      </div>
    </div>
  )
}

// ─── StatsBar ─────────────────────────────────────────────────────────────────

function ShareStatsBar({ zones }: { zones: Zone[] }) {
  const total = zones.length
  if (!total) return null
  const avgPct = Math.round(zones.reduce((a, z) => a + z.completion_pct, 0) / total)
  const counts = ZONE_STATUS.reduce<Record<string, number>>((acc, s) => {
    acc[s] = zones.filter((z) => z.status === s).length
    return acc
  }, {})
  return (
    <div className="flex flex-wrap items-center gap-3 border-b bg-gray-50 px-4 py-2 text-xs text-gray-600">
      <span className="font-medium text-gray-900">{total} khu vực</span>
      <span>Tiến độ TB: <strong>{avgPct}%</strong></span>
      {ZONE_STATUS.map((s) =>
        counts[s] ? (
          <span key={s} className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: ZONE_STATUS_COLOR[s] }} />
            {STATUS_LABELS[s]}: <strong>{counts[s]}</strong>
          </span>
        ) : null,
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ShareView() {
  const { token } = useParams<{ token: string }>()

  const [shareData, setShareData] = useState<ShareData | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedLayerId, setSelectedLayerId] = useState<number | null>(null)
  const [filterStatus, setFilterStatus] = useState<string | null>(null)
  const [zonePopup, setZonePopup] = useState<{ zone: Zone; x: number; y: number } | null>(null)

  useEffect(() => {
    if (!token) return
    const load = async () => {
      try {
        const resp = await publicClient.get(`/share/${token}`)
        const data = (resp.data as { success: boolean; data: ShareData }).data
        setShareData(data)

        // Chọn layer ready đầu tiên
        const firstReady = (data.layers ?? []).find((l) => l.status === 'ready')
          ?? data.layers?.[0]
        if (firstReady) setSelectedLayerId(firstReady.id)
      } catch (err) {
        setLoadError(parseApiError(err, 'Link chia sẻ không hợp lệ hoặc đã hết hạn.'))
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [token])

  // ── Derive zones + marks từ selected layer (không cần fetch thêm) ────────
  const selectedLayer = (shareData?.layers ?? []).find((l) => l.id === selectedLayerId) ?? null
  const zones: Zone[] = (selectedLayer?.zones ?? []).map(normalizeZone)
  const marks: Mark[] = (selectedLayer?.zones ?? []).flatMap((z) =>
    (z.marks ?? []).map(normalizeMark),
  )

  // ── Loading / Error states ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-gray-500">Đang tải bản vẽ...</p>
      </div>
    )
  }

  if (loadError || !shareData || !token) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50">
        <div className="rounded-xl border bg-white p-8 text-center shadow-md">
          <p className="text-2xl">🔗</p>
          <p className="mt-2 text-lg font-semibold text-gray-700">Link không hợp lệ</p>
          <p className="mt-1 text-sm text-gray-500">
            {loadError ?? 'Đường dẫn chia sẻ này đã hết hạn hoặc bị thu hồi.'}
          </p>
        </div>
      </div>
    )
  }

  const canRender =
    selectedLayer !== null &&
    selectedLayer.status === 'ready' &&
    (selectedLayer.width_px ?? 0) > 0 &&
    (selectedLayer.height_px ?? 0) > 0

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white px-6 py-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">TienDo</p>
            <h1 className="text-lg font-bold text-gray-900">{shareData.project.name}</h1>
            {shareData.project.address ? (
              <p className="text-xs text-gray-500">{shareData.project.address}</p>
            ) : null}
          </div>
          <div className="text-right text-xs text-gray-400">
            <p>Chế độ: <strong className="capitalize">{shareData.share_link.role}</strong></p>
            <p>Hết hạn: {new Date(shareData.share_link.expires_at).toLocaleDateString('vi-VN')}</p>
          </div>
        </div>

        {/* Layer selector — luôn hiện nếu có nhiều hơn 1, hoặc hiện tên layer duy nhất */}
        {(shareData.layers ?? []).length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {(shareData.layers ?? []).map((layer) => (
              <button
                key={layer.id}
                type="button"
                onClick={() => { setSelectedLayerId(layer.id); setZonePopup(null) }}
                disabled={layer.status !== 'ready'}
                className={`rounded-full border px-3 py-0.5 text-xs font-medium transition ${
                  selectedLayerId === layer.id
                    ? 'border-gray-900 bg-gray-900 text-white'
                    : layer.status === 'ready'
                      ? 'bg-white text-gray-700 hover:bg-gray-100'
                      : 'cursor-not-allowed border-gray-200 text-gray-300'
                }`}
              >
                {layer.master_layer?.name ? `${layer.master_layer.name} — ` : ''}{layer.name}
                {layer.status !== 'ready' ? ' (chưa sẵn sàng)' : ''}
              </button>
            ))}
          </div>
        ) : null}
      </header>

      {/* Stats bar */}
      <ShareStatsBar zones={zones} />

      {/* Canvas */}
      <div className="relative flex-1" style={{ height: 'calc(100vh - 160px)' }}>
        {canRender ? (
          <ShareCanvas
            key={selectedLayer!.id}
            layerId={selectedLayer!.id}
            widthPx={selectedLayer!.width_px!}
            heightPx={selectedLayer!.height_px!}
            zones={zones}
            marks={marks}
            filterStatus={filterStatus}
            onZoneClick={(zone, x, y) => setZonePopup({ zone, x, y })}
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-neutral-800 text-neutral-400">
            {!selectedLayerId
              ? 'Chọn bản vẽ ở trên để xem'
              : selectedLayer?.status === 'processing'
                ? 'Bản vẽ đang được xử lý...'
                : 'Bản vẽ chưa sẵn sàng'}
          </div>
        )}

        {/* ZoneInfoPopup */}
        {zonePopup ? (
          <div className="absolute z-50" style={{
            top: Math.min(zonePopup.y - 65, window.innerHeight - 300),
            left: Math.min(zonePopup.x + 8, window.innerWidth - 260),
          }}>
            <ShareZoneInfoPopup zone={zonePopup.zone} onClose={() => setZonePopup(null)} />
          </div>
        ) : null}

        {/* Filter chips */}
        <div className="absolute left-4 top-4 z-10 flex flex-wrap gap-1">
          <button type="button" onClick={() => setFilterStatus(null)}
            className={`rounded-full border px-2.5 py-0.5 text-xs font-medium backdrop-blur-sm ${
              !filterStatus ? 'border-transparent bg-gray-900 text-white' : 'bg-white/80 text-gray-700 hover:bg-white'
            }`}>
            Tất cả
          </button>
          {ZONE_STATUS.map((s) => (
            <button key={s} type="button"
              onClick={() => setFilterStatus(filterStatus === s ? null : s)}
              style={filterStatus === s ? { backgroundColor: ZONE_STATUS_COLOR[s], color: '#fff', borderColor: 'transparent' } : {}}
              className={`rounded-full border px-2.5 py-0.5 text-xs font-medium backdrop-blur-sm ${
                filterStatus === s ? '' : 'bg-white/80 text-gray-700 hover:bg-white'
              }`}>
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>

        {/* Legend */}
        <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-1 rounded-lg border bg-white/90 p-2 text-xs shadow-md backdrop-blur-sm">
          {ZONE_STATUS.map((s) => (
            <div key={s} className="flex items-center gap-2 text-gray-600">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: ZONE_STATUS_COLOR[s] }} />
              {STATUS_LABELS[s]}
            </div>
          ))}
        </div>
      </div>

      <footer className="border-t bg-white px-6 py-2 text-center text-xs text-gray-400">
        Powered by <strong>TienDo</strong> — Quản lý tiến độ thi công
      </footer>
    </div>
  )
}
