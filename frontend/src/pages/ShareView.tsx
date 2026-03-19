/**
 * ShareView — public route /share/:token
 * Không cần đăng nhập. Gọi GET /share/{token} để lấy project info + layer list.
 * Sau đó load canvas read-only cho layer đầu tiên (hoặc layer được chọn).
 */
import axios from 'axios'
import { useEffect, useRef, useState } from 'react'
import { fabric } from 'fabric'
import { useParams } from 'react-router-dom'

import { ZONE_STATUS, ZONE_STATUS_COLOR, MARK_STATUS_COLOR } from '@/lib/constants'
import type { Zone, Mark, Geometry } from '@/stores/canvasStore'

// ─── Types ──────────────────────────────────────────────────────────────────

type ShareData = {
  token: string
  role: 'editor' | 'viewer'
  expires_at: string
  project: {
    id: number
    name: string
    code: string
    description: string | null
    address: string | null
  }
  master_layers: MasterLayerItem[]
}

type MasterLayerItem = {
  id: number
  name: string
  layers: LayerItem[]
}

type LayerItem = {
  id: number
  name: string
  status: 'pending' | 'processing' | 'ready' | 'error'
  width_px: number | null
  height_px: number | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Public API client (no auth header)
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
        <button
          type="button"
          onClick={onClose}
          className="ml-2 flex-shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100"
        >
          ✕
        </button>
      </div>
      <div className="space-y-2 p-4 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-gray-500">Trạng thái</span>
          <span className="rounded-full px-2 py-0.5 text-xs font-medium text-white" style={{ backgroundColor: color }}>
            {STATUS_LABELS[zone.status]}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-500">Tiến độ</span>
          <span className="font-bold">{zone.completion_pct}%</span>
        </div>
        {zone.assignee ? (
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Được giao</span>
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
          <div
            className="h-full rounded-full"
            style={{ width: `${zone.completion_pct}%`, backgroundColor: color }}
          />
        </div>
      </div>
    </div>
  )
}

// ─── ShareCanvas ─────────────────────────────────────────────────────────────

interface ShareCanvasProps {
  layerId: number
  widthPx: number
  heightPx: number
  token: string
  filterStatus: string | null
  onZoneClick: (zone: Zone, x: number, y: number) => void
}

function ShareCanvas({ layerId, widthPx, heightPx, token, filterStatus, onZoneClick }: ShareCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fabricRef = useRef<fabric.Canvas | null>(null)
  const [zones, setZones] = useState<Zone[]>([])
  const [marks, setMarks] = useState<Mark[]>([])

  // Fetch zones + marks for this layer via public token endpoint
  useEffect(() => {
    const load = async () => {
      try {
        const resp = await publicClient.get(`/share/${token}/layers/${layerId}/zones`)
        const data = resp.data as { success: boolean; data: Zone[] }
        setZones(data.data)

        const markArrays = await Promise.all(
          data.data.map((z: Zone) =>
            publicClient
              .get(`/share/${token}/zones/${z.id}/marks`)
              .then((r) => {
                const mr = r.data as { success: boolean; data: Mark[] }
                return mr.data
              })
              .catch(() => [] as Mark[]),
          ),
        )
        setMarks(markArrays.flat())
      } catch {
        // silently fail — canvas stays empty
      }
    }
    void load()
  }, [layerId, token])

  // Init fabric
  useEffect(() => {
    if (!canvasRef.current) return
    const fc = new fabric.Canvas(canvasRef.current, {
      selection: false,
      renderOnAddRemove: false,
    })
    fabricRef.current = fc

    fc.on('mouse:down', (e: fabric.IEvent<MouseEvent>) => {
      const target = e.target as (fabric.Object & { data?: { role?: string; id?: number } }) | null
      if (target?.data?.role === 'zone') {
        const zone = zones.find((z) => z.id === target.data!.id)
        if (zone) onZoneClick(zone, e.e.clientX, e.e.clientY)
      }
    })

    return () => {
      fc.dispose()
      fabricRef.current = null
    }
  }, [zones, onZoneClick])

  useEffect(() => {
    const fc = fabricRef.current
    if (!fc) return
    fc.clear()

    const visible = filterStatus ? zones.filter((z) => z.status === filterStatus) : zones

    for (const zone of visible) {
      const pts = toAbsPoints(zone.geometry_pct, widthPx, heightPx)
      if (pts.length < 2) continue
      const color = ZONE_STATUS_COLOR[zone.status] ?? '#9CA3AF'

      fc.add(
        new fabric.Polygon(pts, {
          fill: zone.status === 'not_started' ? 'transparent' : hexWithAlpha(color, 0.15),
          stroke: color,
          strokeWidth: 2,
          selectable: false,
          evented: true,
          hoverCursor: 'pointer',
          data: { role: 'zone', id: zone.id },
        }),
      )

      const c = centroid(pts)
      fc.add(
        new fabric.Text(zone.zone_code || zone.name, {
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
        }),
      )
    }

    for (const mark of marks) {
      const pts = toAbsPoints(mark.geometry_pct, widthPx, heightPx)
      if (pts.length < 2) continue
      const color = MARK_STATUS_COLOR[mark.status] ?? '#F59E0B'
      fc.add(
        new fabric.Polygon(pts, {
          fill: hexWithAlpha(color, 0.5),
          stroke: color,
          strokeWidth: 1.5,
          selectable: false,
          evented: false,
        }),
      )
    }

    fc.renderAll()
  }, [zones, marks, filterStatus, widthPx, heightPx])

  // Zoom / pan via mouse wheel + drag (simple — không dùng canvasStore)
  const zoom = useRef(1)
  const panOffset = useRef({ x: 0, y: 0 })
  const isPanning = useRef(false)
  const panStart = useRef({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  const applyTransform = () => {
    if (!containerRef.current) return
    containerRef.current.style.transform =
      `translate(${panOffset.current.x}px, ${panOffset.current.y}px) scale(${zoom.current})`
  }

  useEffect(() => {
    const el = containerRef.current?.parentElement
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

  return (
    <div
      className="relative overflow-hidden bg-neutral-800"
      style={{ width: '100%', height: '100%' }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={stopPan}
      onMouseLeave={stopPan}
    >
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
        {/* Tiles */}
        {Array.from({ length: Math.ceil(heightPx / 1024) }, (_, row) =>
          Array.from({ length: Math.ceil(widthPx / 1024) }, (_, col) => {
            const left = col * 1024
            const top = row * 1024
            return (
              <img
                key={`${col}_${row}`}
                src={`/api/v1/layers/${layerId}/tiles/0_${col}_${row}.jpg`}
                alt=""
                draggable={false}
                style={{ position: 'absolute', left, top, width: Math.min(1024, widthPx - left), height: Math.min(1024, heightPx - top) }}
              />
            )
          }),
        )}
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

// ─── StatsBar ─────────────────────────────────────────────────────────────

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

// ─── Main page ────────────────────────────────────────────────────────────

export default function ShareView() {
  const { token } = useParams<{ token: string }>()

  const [shareData, setShareData] = useState<ShareData | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [selectedLayerId, setSelectedLayerId] = useState<number | null>(null)
  const [filterStatus, setFilterStatus] = useState<string | null>(null)
  const [zonePopup, setZonePopup] = useState<{ zone: Zone; x: number; y: number } | null>(null)
  const [allZones] = useState<Zone[]>([])

  // Collect zones from ShareCanvas child for stats — via callback
  const [layerZones, setLayerZones] = useState<Zone[]>([])

  useEffect(() => {
    if (!token) return
    const load = async () => {
      try {
        const resp = await publicClient.get(`/share/${token}`)
        const data = resp.data as { success: boolean; data: ShareData }
        setShareData(data.data)

        // Pre-select first ready layer
        const firstReady = data.data.master_layers
          .flatMap((ml) => ml.layers)
          .find((l) => l.status === 'ready')
        if (firstReady) setSelectedLayerId(firstReady.id)
      } catch (err) {
        setLoadError(parseApiError(err, 'Link chia sẻ không hợp lệ hoặc đã hết hạn.'))
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [token])

  // Load zones for stats when layer changes
  useEffect(() => {
    if (!token || !selectedLayerId) return
    publicClient
      .get(`/share/${token}/layers/${selectedLayerId}/zones`)
      .then((r) => {
        const data = r.data as { success: boolean; data: Zone[] }
        setLayerZones(data.data)
      })
      .catch(() => setLayerZones([]))
  }, [token, selectedLayerId])

  void allZones // used in future when we aggregate across layers

  const selectedLayer = shareData?.master_layers
    .flatMap((ml) => ml.layers)
    .find((l) => l.id === selectedLayerId)

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-gray-500">Đang tải...</p>
      </div>
    )
  }

  if (loadError || !shareData || !token) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50">
        <div className="rounded-xl border bg-white p-8 text-center shadow-md">
          <p className="text-2xl font-bold text-gray-900">🔗</p>
          <p className="mt-2 text-lg font-semibold text-gray-700">Link không hợp lệ</p>
          <p className="mt-1 text-sm text-gray-500">{loadError ?? 'Đường dẫn chia sẻ này đã hết hạn hoặc bị thu hồi.'}</p>
        </div>
      </div>
    )
  }

  const layerReady = selectedLayer?.status === 'ready'
  const widthPx = selectedLayer?.width_px ?? 2480
  const heightPx = selectedLayer?.height_px ?? 3508

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* Public header */}
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
            <p>Chế độ xem: <strong className="capitalize">{shareData.role}</strong></p>
            <p>Hết hạn: {new Date(shareData.expires_at).toLocaleDateString('vi-VN')}</p>
          </div>
        </div>

        {/* Layer selector */}
        <div className="mt-3 flex flex-wrap gap-2">
          {shareData.master_layers.map((ml) => (
            <div key={ml.id} className="flex items-center gap-1">
              <span className="text-xs font-medium text-gray-500">{ml.name}:</span>
              {ml.layers.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => { setSelectedLayerId(l.id); setZonePopup(null) }}
                  disabled={l.status !== 'ready'}
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium border transition ${
                    selectedLayerId === l.id
                      ? 'bg-gray-900 text-white border-gray-900'
                      : l.status === 'ready'
                        ? 'bg-white hover:bg-gray-100 text-gray-700'
                        : 'text-gray-300 border-gray-200 cursor-not-allowed'
                  }`}
                >
                  {l.name}
                  {l.status !== 'ready' ? ' (chưa sẵn sàng)' : ''}
                </button>
              ))}
            </div>
          ))}
        </div>
      </header>

      {/* Stats bar */}
      <ShareStatsBar zones={layerZones} />

      {/* Canvas area */}
      <div className="relative flex-1" style={{ height: 'calc(100vh - 160px)' }}>
        {selectedLayerId && layerReady && token ? (
          <ShareCanvas
            key={selectedLayerId}
            layerId={selectedLayerId}
            widthPx={widthPx}
            heightPx={heightPx}
            token={token}
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
          <div
            className="absolute z-50"
            style={{
              top: Math.min(zonePopup.y - 65, window.innerHeight - 300),
              left: Math.min(zonePopup.x + 8, window.innerWidth - 260),
            }}
          >
            <ShareZoneInfoPopup zone={zonePopup.zone} onClose={() => setZonePopup(null)} />
          </div>
        ) : null}

        {/* Filter chips */}
        <div className="absolute left-4 top-4 z-10 flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => setFilterStatus(null)}
            className={`rounded-full border px-2.5 py-0.5 text-xs font-medium backdrop-blur-sm ${!filterStatus ? 'bg-gray-900 text-white border-transparent' : 'bg-white/80 text-gray-700 hover:bg-white'}`}
          >
            Tất cả
          </button>
          {ZONE_STATUS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFilterStatus(filterStatus === s ? null : s)}
              style={filterStatus === s ? { backgroundColor: ZONE_STATUS_COLOR[s], color: '#fff', borderColor: 'transparent' } : {}}
              className={`rounded-full border px-2.5 py-0.5 text-xs font-medium backdrop-blur-sm ${filterStatus === s ? '' : 'bg-white/80 text-gray-700 hover:bg-white'}`}
            >
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

      {/* Footer */}
      <footer className="border-t bg-white px-6 py-2 text-center text-xs text-gray-400">
        Powered by <strong>TienDo</strong> — Quản lý tiến độ thi công
      </footer>
    </div>
  )
}
