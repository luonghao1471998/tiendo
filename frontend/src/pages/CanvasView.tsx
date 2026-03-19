import { useEffect, useRef, useState } from 'react'
import { fabric } from 'fabric'
import { Link, useParams } from 'react-router-dom'

import client from '@/api/client'
import CanvasWrapper from '@/components/canvas/CanvasWrapper'
import TileLayer from '@/components/canvas/TileLayer'
import ZoomControls from '@/components/canvas/ZoomControls'
import { ZONE_STATUS, ZONE_STATUS_COLOR, MARK_STATUS_COLOR } from '@/lib/constants'
import type { Zone, Geometry } from '@/stores/canvasStore'
import useCanvasStore from '@/stores/canvasStore'

// ─── Types ─────────────────────────────────────────────────────────────────

type LayerInfo = {
  id: number
  name: string
  status: 'pending' | 'processing' | 'ready' | 'error'
  width_px: number | null
  height_px: number | null
  tile_path: string | null
}

type ApiResponse<T> = { success: boolean; data: T }

// ─── Helpers ───────────────────────────────────────────────────────────────

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

// ─── ZoneInfoPopup (read-only) ─────────────────────────────────────────────

function ZoneInfoPopup({ zone, onClose }: { zone: Zone; onClose: () => void }) {
  const color = ZONE_STATUS_COLOR[zone.status] ?? '#9CA3AF'
  return (
    <div className="w-64 rounded-xl border bg-card shadow-xl">
      <div className="flex items-center justify-between rounded-t-xl bg-muted/60 px-4 py-2">
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">{zone.zone_code}</p>
          <p className="truncate font-semibold">{zone.name}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="ml-2 flex-shrink-0 rounded p-1 text-muted-foreground hover:bg-muted"
        >
          ✕
        </button>
      </div>
      <div className="space-y-2 p-4 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Trạng thái</span>
          <span
            className="rounded-full px-2 py-0.5 text-xs font-medium text-white"
            style={{ backgroundColor: color }}
          >
            {STATUS_LABELS[zone.status]}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Tiến độ</span>
          <span className="font-bold">{zone.completion_pct}%</span>
        </div>
        {zone.assignee ? (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Được giao</span>
            <span>{zone.assignee}</span>
          </div>
        ) : null}
        {zone.deadline ? (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Deadline</span>
            <span>{zone.deadline}</span>
          </div>
        ) : null}
        {zone.notes ? (
          <div className="border-t pt-2">
            <p className="text-xs text-muted-foreground">Ghi chú</p>
            <p className="mt-0.5 text-sm">{zone.notes}</p>
          </div>
        ) : null}
        {/* Progress bar */}
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${zone.completion_pct}%`, backgroundColor: color }}
          />
        </div>
      </div>
    </div>
  )
}

// ─── ReadOnlyCanvas ────────────────────────────────────────────────────────

interface ReadOnlyCanvasProps {
  widthPx: number
  heightPx: number
  filterStatus: string | null
  onZoneClick: (zone: Zone, x: number, y: number) => void
}

function ReadOnlyCanvas({ widthPx, heightPx, filterStatus, onZoneClick }: ReadOnlyCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fabricRef = useRef<fabric.Canvas | null>(null)
  const zones = useCanvasStore((s) => s.zones)
  const marks = useCanvasStore((s) => s.marks)

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
        const zone = useCanvasStore.getState().zones.find((z) => z.id === target.data!.id)
        if (zone) onZoneClick(zone, e.e.clientX, e.e.clientY)
      }
    })

    return () => {
      fc.dispose()
      fabricRef.current = null
    }
  }, [onZoneClick])

  useEffect(() => {
    const fc = fabricRef.current
    if (!fc) return
    fc.clear()

    const visibleZones = filterStatus ? zones.filter((z) => z.status === filterStatus) : zones

    for (const zone of visibleZones) {
      const pts = toAbsPoints(zone.geometry_pct, widthPx, heightPx)
      if (pts.length < 2) continue
      const color = ZONE_STATUS_COLOR[zone.status] ?? '#9CA3AF'

      const poly = new fabric.Polygon(pts, {
        fill: zone.status === 'not_started' ? 'transparent' : hexWithAlpha(color, 0.15),
        stroke: color,
        strokeWidth: 2,
        selectable: false,
        evented: true,
        hoverCursor: 'pointer',
        data: { role: 'zone', id: zone.id },
      })
      fc.add(poly)

      const c = centroid(pts)
      const label = new fabric.Text(zone.zone_code || zone.name, {
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
      })
      fc.add(label)
    }

    for (const mark of marks) {
      const pts = toAbsPoints(mark.geometry_pct, widthPx, heightPx)
      if (pts.length < 2) continue
      const color = MARK_STATUS_COLOR[mark.status] ?? '#F59E0B'
      const poly = new fabric.Polygon(pts, {
        fill: hexWithAlpha(color, 0.5),
        stroke: color,
        strokeWidth: 1.5,
        selectable: false,
        evented: false,
      })
      fc.add(poly)
    }

    fc.renderAll()
  }, [zones, marks, filterStatus, widthPx, heightPx])

  return (
    <canvas
      ref={canvasRef}
      width={widthPx}
      height={heightPx}
      style={{ position: 'absolute', inset: 0 }}
    />
  )
}

// ─── StatsBar ──────────────────────────────────────────────────────────────

function StatsBar({ zones }: { zones: Zone[] }) {
  const total = zones.length
  if (total === 0) return null

  const counts = ZONE_STATUS.reduce<Record<string, number>>((acc, s) => {
    acc[s] = zones.filter((z) => z.status === s).length
    return acc
  }, {})

  const avgPct = Math.round(zones.reduce((a, z) => a + z.completion_pct, 0) / total)

  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-2 text-xs border-b bg-muted/30">
      <span className="font-medium text-foreground">{total} khu vực</span>
      <span className="text-muted-foreground">Tiến độ trung bình: <strong>{avgPct}%</strong></span>
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

// ─── Main page ──────────────────────────────────────────────────────────────

export default function CanvasView() {
  const { id: projectId, layerId } = useParams<{ id: string; layerId: string }>()

  const [layer, setLayer] = useState<LayerInfo | null>(null)
  const [layerError, setLayerError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  const [filterStatus, setFilterStatus] = useState<string | null>(null)
  const [zonePopup, setZonePopup] = useState<{ zone: Zone; x: number; y: number } | null>(null)

  const zones = useCanvasStore((s) => s.zones)
  const lastSyncAt = useCanvasStore((s) => s.lastSyncAt)
  const { fetchZonesAndMarks, syncSince, reset } = useCanvasStore()

  const layerIdNum = Number(layerId)
  const projectIdNum = Number(projectId)

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

  useEffect(() => {
    if (!layerIdNum) return
    const id = setInterval(() => {
      if (lastSyncAt) void syncSince(layerIdNum, lastSyncAt)
    }, 30_000)
    return () => clearInterval(id)
  }, [layerIdNum, lastSyncAt, syncSince])

  // Export Excel: trigger browser download via URL with auth token from Axios default headers
  const handleExport = async () => {
    setExporting(true)
    try {
      const resp = await client.get(`/layers/${layerIdNum}/export/excel`, {
        responseType: 'blob',
      })
      const blob = resp.data as Blob
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `layer_${layerIdNum}_export.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      alert(parseApiError(err, 'Xuất Excel thất bại.'))
    } finally {
      setExporting(false)
    }
  }

  const layerReady = layer?.status === 'ready'
  const widthPx = layer?.width_px ?? 2480
  const heightPx = layer?.height_px ?? 3508

  if (layerError) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-red-600">{layerError}</p>
      </div>
    )
  }

  return (
    <div
      style={{ height: 'calc(100vh - 65px)', display: 'flex', flexDirection: 'column' }}
      className="overflow-hidden"
    >
      {/* Context bar */}
      <div className="flex items-center gap-3 border-b bg-card px-4 py-2 text-sm">
        <Link to={`/projects/${projectIdNum}`} className="text-muted-foreground hover:underline">
          ← Dự án
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="font-medium">{layer?.name ?? `Layer #${layerIdNum}`}</span>
        <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700">
          Chỉ xem
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => void handleExport()}
            disabled={exporting}
            className="flex items-center gap-1.5 rounded-lg border bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
          >
            {exporting ? (
              'Đang xuất...'
            ) : (
              <>
                <span>⬇</span> Xuất Excel
              </>
            )}
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <StatsBar zones={zones} />

      {/* Main */}
      <div className="flex flex-1 overflow-hidden">
        {/* Canvas */}
        <div className="relative flex-1 overflow-hidden">
          {layerReady ? (
            <CanvasWrapper widthPx={widthPx} heightPx={heightPx}>
              <TileLayer layerId={layerIdNum} widthPx={widthPx} heightPx={heightPx} />
              <ReadOnlyCanvas
                widthPx={widthPx}
                heightPx={heightPx}
                filterStatus={filterStatus}
                onZoneClick={(zone, x, y) => setZonePopup({ zone, x, y })}
              />
            </CanvasWrapper>
          ) : (
            <div className="flex h-full items-center justify-center bg-neutral-800 text-neutral-400">
              {layer?.status === 'processing' ? 'Đang xử lý...' : layer ? `Layer chưa sẵn sàng (${layer.status})` : 'Đang tải...'}
            </div>
          )}

          {/* ZoneInfoPopup */}
          {zonePopup ? (
            <div
              className="absolute z-50"
              style={{
                top: Math.min(zonePopup.y - 65, window.innerHeight - 350),
                left: Math.min(zonePopup.x + 8, window.innerWidth - 280),
              }}
            >
              <ZoneInfoPopup zone={zonePopup.zone} onClose={() => setZonePopup(null)} />
            </div>
          ) : null}

          {/* Filter chips — top-left */}
          <div className="absolute left-4 top-4 z-10 flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => setFilterStatus(null)}
              className={`rounded-full border px-2.5 py-0.5 text-xs font-medium backdrop-blur-sm ${!filterStatus ? 'bg-foreground text-background' : 'bg-background/80 hover:bg-background'}`}
            >
              Tất cả
            </button>
            {ZONE_STATUS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setFilterStatus(filterStatus === s ? null : s)}
                style={filterStatus === s ? { backgroundColor: ZONE_STATUS_COLOR[s], color: '#fff', borderColor: ZONE_STATUS_COLOR[s] } : {}}
                className={`rounded-full border px-2.5 py-0.5 text-xs font-medium backdrop-blur-sm ${filterStatus === s ? '' : 'bg-background/80 hover:bg-background'}`}
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
          <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-1 rounded-lg border bg-background/90 p-2 backdrop-blur-sm text-xs">
            {ZONE_STATUS.map((s) => (
              <div key={s} className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: ZONE_STATUS_COLOR[s] }} />
                {STATUS_LABELS[s]}
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar — zone list read-only */}
        <aside className="flex w-72 flex-col border-l bg-card">
          <div className="border-b px-4 py-3">
            <p className="font-semibold">Khu vực</p>
            <p className="text-sm text-muted-foreground">{zones.length} khu vực</p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {zones.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">Chưa có khu vực nào.</p>
            ) : (
              <ul>
                {(filterStatus ? zones.filter((z) => z.status === filterStatus) : zones).map((zone) => {
                  const color = ZONE_STATUS_COLOR[zone.status] ?? '#9CA3AF'
                  return (
                    <li key={zone.id}>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2.5 border-b px-4 py-2.5 text-left text-sm hover:bg-muted/40"
                        onClick={() => setZonePopup({ zone, x: 320, y: 120 })}
                      >
                        <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: color }} />
                        <span className="flex-1 truncate">{zone.name}</span>
                        <div className="flex flex-col items-end">
                          <span className="text-xs font-medium">{zone.completion_pct}%</span>
                          <div className="mt-0.5 h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${zone.completion_pct}%`, backgroundColor: color }}
                            />
                          </div>
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
