import { useEffect, useRef, useState } from 'react'
import { fabric } from 'fabric'
import { Link, useParams } from 'react-router-dom'

import client from '@/api/client'
import CanvasWrapper from '@/components/canvas/CanvasWrapper'
import TileLayer from '@/components/canvas/TileLayer'
import ZoomControls from '@/components/canvas/ZoomControls'
import { ZONE_STATUS, ZONE_STATUS_COLOR, MARK_STATUS_COLOR } from '@/lib/constants'
import type { Zone, Mark, Geometry } from '@/stores/canvasStore'
import useCanvasStore from '@/stores/canvasStore'
import useAuthStore from '@/stores/authStore'

// ─── Shared types ──────────────────────────────────────────────────────────

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

// Allowed transitions for field_team on their own zones
const FIELD_TEAM_TRANSITIONS: Record<string, string[]> = {
  not_started: ['in_progress'],
  in_progress: ['paused'],
  paused: ['in_progress'],
  delayed: ['in_progress'],
  completed: [],
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

// ─── StatusPopup ───────────────────────────────────────────────────────────

function StatusPopup({
  zone,
  onClose,
  onSaved,
}: {
  zone: Zone
  onClose: () => void
  onSaved: (updated: Zone) => void
}) {
  const { updateZone } = useCanvasStore()
  const [status, setStatus] = useState(zone.status)
  const [pct, setPct] = useState(zone.completion_pct)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const allowed = FIELD_TEAM_TRANSITIONS[zone.status] ?? []

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      // Update status via PATCH /zones/{id}/status if changed
      if (status !== zone.status) {
        await client.patch(`/zones/${zone.id}/status`, { status })
      }
      // Update completion_pct via PUT /zones/{id}
      const resp = (await client.patch(`/zones/${zone.id}`, {
        completion_pct: pct,
      })) as { data: ApiResponse<Zone> }
      const updated = resp.data.data
      updateZone(updated)
      onSaved(updated)
      onClose()
    } catch (err) {
      setError(parseApiError(err, 'Lưu thất bại.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="absolute z-50 w-64 rounded-xl border bg-card shadow-xl" style={{ top: 0, left: 0 }}>
      {/* Drag-handle header */}
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

      <div className="space-y-3 p-4">
        {/* Status */}
        <div>
          <label className="mb-1 block text-xs font-medium">Trạng thái</label>
          {allowed.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {STATUS_LABELS[zone.status]} — không thể thay đổi
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {/* Keep current */}
              <button
                type="button"
                onClick={() => setStatus(zone.status)}
                className={`rounded-full px-3 py-1 text-xs font-medium border transition ${
                  status === zone.status ? 'bg-foreground text-background' : 'hover:bg-muted'
                }`}
              >
                {STATUS_LABELS[zone.status]}
              </button>
              {/* Allowed transitions */}
              {allowed.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s as Zone['status'])}
                  style={
                    status === s
                      ? { backgroundColor: ZONE_STATUS_COLOR[s as keyof typeof ZONE_STATUS_COLOR], color: '#fff', borderColor: 'transparent' }
                      : {}
                  }
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    status === s ? '' : 'hover:bg-muted'
                  }`}
                >
                  → {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* % Slider */}
        <div>
          <label className="mb-1 flex justify-between text-xs font-medium">
            <span>Tiến độ</span>
            <span className="font-bold">{pct}%</span>
          </label>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={pct}
            onChange={(e) => setPct(Number(e.target.value))}
            className="w-full accent-primary"
          />
        </div>

        {error ? <p className="text-xs text-red-600">{error}</p> : null}

        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="w-full rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {saving ? 'Đang lưu...' : 'Lưu tiến độ'}
        </button>
      </div>
    </div>
  )
}

// ─── MarkPopup (click mark → đổi status / xóa) ────────────────────────────

function MarkPopup({
  mark,
  onClose,
}: {
  mark: Mark
  onClose: () => void
}) {
  const { updateMark, removeMark } = useCanvasStore()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggle = async () => {
    const next = mark.status === 'in_progress' ? 'completed' : 'in_progress'
    setSaving(true)
    setError(null)
    try {
      const resp = (await client.patch(`/marks/${mark.id}/status`, {
        status: next,
      })) as { data: ApiResponse<Mark> }
      updateMark(resp.data.data)
      onClose()
    } catch (err) {
      setError(parseApiError(err, 'Đổi trạng thái thất bại.'))
    } finally {
      setSaving(false)
    }
  }

  const deleteMark = async () => {
    if (!confirm('Xóa vùng tô này?')) return
    setSaving(true)
    try {
      await client.delete(`/marks/${mark.id}`)
      removeMark(mark.id)
      onClose()
    } catch (err) {
      setError(parseApiError(err, 'Xóa thất bại.'))
      setSaving(false)
    }
  }

  const labelColor = mark.status === 'in_progress' ? '#F59E0B' : '#10B981'
  const nextLabel = mark.status === 'in_progress' ? '→ Hoàn thành' : '→ Đang thi công'

  return (
    <div className="absolute z-50 w-52 rounded-xl border bg-card shadow-xl" style={{ top: 0, left: 0 }}>
      <div className="flex items-center justify-between rounded-t-xl bg-muted/60 px-3 py-2">
        <span className="text-sm font-semibold" style={{ color: labelColor }}>
          Vùng tô
        </span>
        <button type="button" onClick={onClose} className="rounded p-1 text-muted-foreground hover:bg-muted">
          ✕
        </button>
      </div>
      <div className="space-y-2 p-3">
        <p className="text-xs text-muted-foreground">
          Trạng thái: <strong>{mark.status === 'in_progress' ? 'Đang thi công' : 'Hoàn thành'}</strong>
        </p>
        {error ? <p className="text-xs text-red-600">{error}</p> : null}
        <button
          type="button"
          onClick={() => void toggle()}
          disabled={saving}
          className="w-full rounded-lg bg-primary py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-60"
        >
          {saving ? '...' : nextLabel}
        </button>
        <button
          type="button"
          onClick={() => void deleteMark()}
          disabled={saving}
          className="w-full rounded-lg border border-red-300 py-1.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-60"
        >
          Xóa vùng tô
        </button>
      </div>
    </div>
  )
}

// ─── Preview draw helpers (module-level để tránh closure với useEffect) ──────

function clearPreview(
  fc: fabric.Canvas,
  lineRef: React.MutableRefObject<fabric.Polyline | null>,
  polyRef: React.MutableRefObject<fabric.Polygon | null>,
) {
  if (lineRef.current) { fc.remove(lineRef.current); lineRef.current = null }
  if (polyRef.current) { fc.remove(polyRef.current); polyRef.current = null }
}

function renderPreview(
  fc: fabric.Canvas,
  pts: { x: number; y: number }[],
  markStatus: 'in_progress' | 'completed',
  lineRef: React.MutableRefObject<fabric.Polyline | null>,
  polyRef: React.MutableRefObject<fabric.Polygon | null>,
) {
  clearPreview(fc, lineRef, polyRef)
  if (pts.length < 2) return
  const color = MARK_STATUS_COLOR[markStatus]

  const line = new fabric.Polyline(pts, {
    stroke: color,
    strokeWidth: 2,
    strokeDashArray: [6, 4],
    fill: 'transparent',
    selectable: false,
    evented: false,
    data: { role: 'preview' },
  })
  fc.add(line)
  lineRef.current = line

  if (pts.length >= 3) {
    const poly = new fabric.Polygon(pts, {
      fill: hexWithAlpha(color, 0.25),
      stroke: 'transparent',
      selectable: false,
      evented: false,
      data: { role: 'preview' },
    })
    fc.add(poly)
    polyRef.current = poly
  }
  fc.renderAll()
}

// ─── MarkDrawCanvas — Fabric canvas vẽ zone + mark ─────────────────────────

interface MarkDrawCanvasProps {
  widthPx: number
  heightPx: number
  currentUserId: number | undefined
  isDrawingMark: boolean
  markStatusDraw: 'in_progress' | 'completed'
  onMarkDrawn: (zoneId: number, geometry: Geometry) => Promise<void>
  onZoneClick: (zone: Zone, x: number, y: number) => void
  onMarkClick: (mark: Mark, x: number, y: number) => void
}

function MarkDrawCanvas({
  widthPx,
  heightPx,
  currentUserId,
  isDrawingMark,
  markStatusDraw,
  onMarkDrawn,
  onZoneClick,
  onMarkClick,
}: MarkDrawCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fabricRef = useRef<fabric.Canvas | null>(null)
  const drawPoints = useRef<{ x: number; y: number }[]>([])
  const previewLineRef = useRef<fabric.Polyline | null>(null)
  const previewPolyRef = useRef<fabric.Polygon | null>(null)

  const zones = useCanvasStore((s) => s.zones)
  const marks = useCanvasStore((s) => s.marks)

  // Init fabric
  useEffect(() => {
    if (!canvasRef.current) return
    const fc = new fabric.Canvas(canvasRef.current, {
      selection: false,
      renderOnAddRemove: false,
    })
    fabricRef.current = fc
    return () => {
      fc.dispose()
      fabricRef.current = null
    }
  }, [])

  // Render zones + marks
  useEffect(() => {
    const fc = fabricRef.current
    if (!fc) return

    // Clear everything except draw-preview objects
    const toRemove = fc.getObjects().filter(
      (o) => (o as { data?: { role?: string } }).data?.role !== 'preview',
    )
    toRemove.forEach((o) => fc.remove(o))

    // Zones
    for (const zone of zones) {
      const pts = toAbsPoints(zone.geometry_pct, widthPx, heightPx)
      if (pts.length < 2) continue
      const color = ZONE_STATUS_COLOR[zone.status] ?? '#9CA3AF'
      const isOwn = zone.assigned_user_id === currentUserId
      const opacity = !isOwn ? 0.08 : 1

      const poly = new fabric.Polygon(pts, {
        fill: zone.status === 'not_started' ? 'transparent' : hexWithAlpha(color, 0.15),
        stroke: color,
        strokeWidth: 2,
        opacity,
        selectable: false,
        hasControls: false,
        evented: true,
        data: { role: 'zone', id: zone.id, isOwn },
      })
      fc.add(poly)

      if (isOwn) {
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
    }

    // Marks
    for (const mark of marks) {
      const pts = toAbsPoints(mark.geometry_pct, widthPx, heightPx)
      if (pts.length < 2) continue
      const color = MARK_STATUS_COLOR[mark.status] ?? '#F59E0B'
      const poly = new fabric.Polygon(pts, {
        fill: hexWithAlpha(color, 0.5),
        stroke: color,
        strokeWidth: 1.5,
        selectable: false,
        evented: true,
        data: { role: 'mark', id: mark.id },
      })
      fc.add(poly)
    }

    fc.renderAll()
  }, [zones, marks, widthPx, heightPx, currentUserId])

  // Click / draw handler
  useEffect(() => {
    const fc = fabricRef.current
    if (!fc) return

    const onMouseDown = (e: fabric.IEvent<Event>) => {
      const me = e.e as MouseEvent
      const pointer = fc.getPointer(e.e)

      // Mark draw mode
      if (isDrawingMark) {
        drawPoints.current.push({ x: pointer.x, y: pointer.y })
        renderPreview(fc, drawPoints.current, markStatusDraw, previewLineRef, previewPolyRef)
        return
      }

      // Click mode: identify hit object
      const target = e.target as (fabric.Object & { data?: { role?: string; id?: number; isOwn?: boolean } }) | null
      if (!target?.data) return

      if (target.data.role === 'zone') {
        const zone = zones.find((z) => z.id === target.data!.id)
        if (zone && target.data.isOwn) {
          onZoneClick(zone, me.clientX, me.clientY)
        }
      } else if (target.data.role === 'mark') {
        const mark = marks.find((m) => m.id === target.data!.id)
        if (mark) onMarkClick(mark, me.clientX, me.clientY)
      }
    }

    const onDblClick = async (e: fabric.IEvent<Event>) => {
      if (!isDrawingMark || drawPoints.current.length < 3) return

      // Finish polygon → find zone at centroid
      const pts = [...drawPoints.current]
      const cx = pts.reduce((a, p) => a + p.x, 0) / pts.length
      const cy = pts.reduce((a, p) => a + p.y, 0) / pts.length
      const hitZone = zones.find((z) => {
        if (z.assigned_user_id !== currentUserId) return false
        const zPts = toAbsPoints(z.geometry_pct, widthPx, heightPx)
        return pointInPolygon(cx, cy, zPts)
      })

      if (!hitZone) {
        alert('Vùng tô phải nằm trong khu vực được giao cho bạn.')
        clearPreview(fc, previewLineRef, previewPolyRef)
        drawPoints.current = []
        return
      }

      // Convert to % geometry
      const geometry: Geometry = {
        type: 'polygon',
        points: pts.map((p) => [p.x / widthPx, p.y / heightPx] as [number, number]),
      }

      clearPreview(fc, previewLineRef, previewPolyRef)
      drawPoints.current = []
      void e

      await onMarkDrawn(hitZone.id, geometry)
    }

    fc.on('mouse:down', onMouseDown)
    fc.on('mouse:dblclick', onDblClick)

    return () => {
      fc.off('mouse:down', onMouseDown)
      fc.off('mouse:dblclick', onDblClick)
    }
  }, [isDrawingMark, markStatusDraw, zones, marks, widthPx, heightPx, currentUserId, onZoneClick, onMarkClick, onMarkDrawn])

  // Sync drawing cursor
  useEffect(() => {
    const fc = fabricRef.current
    if (!fc) return
    fc.defaultCursor = isDrawingMark ? 'crosshair' : 'default'
    fc.hoverCursor = isDrawingMark ? 'crosshair' : 'pointer'
  }, [isDrawingMark])

  return (
    <canvas
      ref={canvasRef}
      width={widthPx}
      height={heightPx}
      style={{ position: 'absolute', inset: 0 }}
    />
  )
}

// ─── pointInPolygon util ────────────────────────────────────────────────────

function pointInPolygon(x: number, y: number, polygon: fabric.Point[]): boolean {
  let inside = false
  const n = polygon.length
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y
    const xj = polygon[j].x, yj = polygon[j].y
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

// ─── Main page ──────────────────────────────────────────────────────────────

export default function CanvasProgress() {
  const { id: projectId, layerId } = useParams<{ id: string; layerId: string }>()
  const { user } = useAuthStore()

  const [layer, setLayer] = useState<LayerInfo | null>(null)
  const [layerError, setLayerError] = useState<string | null>(null)

  const [isDrawingMark, setIsDrawingMark] = useState(false)
  const [markStatusDraw, setMarkStatusDraw] = useState<'in_progress' | 'completed'>('in_progress')

  // Popup state — position anchored to click coordinates
  const [zonePopup, setZonePopup] = useState<{ zone: Zone; x: number; y: number } | null>(null)
  const [markPopup, setMarkPopup] = useState<{ mark: Mark; x: number; y: number } | null>(null)

  const [filterStatus, setFilterStatusLocal] = useState<string | null>(null)

  const zones = useCanvasStore((s) => s.zones)
  const lastSyncAt = useCanvasStore((s) => s.lastSyncAt)
  const { fetchZonesAndMarks, syncSince, addMark, reset } = useCanvasStore()

  const layerIdNum = Number(layerId)
  const projectIdNum = Number(projectId)
  const currentUserId = user?.id

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

  // Submit newly drawn mark to API
  const handleMarkDrawn = async (zoneId: number, geometry: Geometry) => {
    try {
      const resp = (await client.post(`/zones/${zoneId}/marks`, {
        geometry_pct: geometry,
        status: markStatusDraw,
      })) as { data: ApiResponse<Mark> }
      addMark(resp.data.data)
    } catch (err) {
      alert(parseApiError(err, 'Tạo vùng tô thất bại.'))
    }
  }

  const ownZones = zones.filter((z) => z.assigned_user_id === currentUserId)

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
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
          Chế độ tiến độ
        </span>
        <span className="ml-auto text-xs text-muted-foreground">
          Khu vực của bạn: {ownZones.length}
        </span>
      </div>

      {/* Main */}
      <div className="flex flex-1 overflow-hidden">
        {/* Canvas area */}
        <div className="relative flex-1 overflow-hidden">
          {layerReady ? (
            <CanvasWrapper widthPx={widthPx} heightPx={heightPx}>
              <TileLayer layerId={layerIdNum} widthPx={widthPx} heightPx={heightPx} />
              <MarkDrawCanvas
                widthPx={widthPx}
                heightPx={heightPx}
                currentUserId={currentUserId}
                isDrawingMark={isDrawingMark}
                markStatusDraw={markStatusDraw}
                onMarkDrawn={handleMarkDrawn}
                onZoneClick={(zone, x, y) => {
                  setMarkPopup(null)
                  setZonePopup({ zone, x, y })
                }}
                onMarkClick={(mark, x, y) => {
                  setZonePopup(null)
                  setMarkPopup({ mark, x, y })
                }}
              />
            </CanvasWrapper>
          ) : (
            <div className="flex h-full items-center justify-center bg-neutral-800 text-neutral-400">
              {layer?.status === 'processing' ? 'Đang xử lý bản vẽ...' : layer ? `Layer chưa sẵn sàng (${layer.status})` : 'Đang tải...'}
            </div>
          )}

          {/* StatusPopup — positioned near click */}
          {zonePopup ? (
            <div
              style={{ position: 'absolute', top: Math.min(zonePopup.y - 65, window.innerHeight - 380), left: Math.min(zonePopup.x + 8, window.innerWidth - 280) }}
              className="z-50"
            >
              <StatusPopup
                zone={zonePopup.zone}
                onClose={() => setZonePopup(null)}
                onSaved={() => setZonePopup(null)}
              />
            </div>
          ) : null}

          {/* MarkPopup */}
          {markPopup ? (
            <div
              style={{ position: 'absolute', top: Math.min(markPopup.y - 65, window.innerHeight - 220), left: Math.min(markPopup.x + 8, window.innerWidth - 220) }}
              className="z-50"
            >
              <MarkPopup mark={markPopup.mark} onClose={() => setMarkPopup(null)} />
            </div>
          ) : null}

          {/* Mark draw toolbar — top-left */}
          <div className="absolute left-4 top-4 z-10 flex items-center gap-2">
            {!isDrawingMark ? (
              <button
                type="button"
                onClick={() => setIsDrawingMark(true)}
                className="flex items-center gap-2 rounded-lg border bg-background/90 px-3 py-1.5 text-sm font-medium shadow-md backdrop-blur-sm hover:bg-muted"
              >
                <span className="h-3 w-3 rounded-sm bg-amber-400" />
                Tô tiến độ
              </button>
            ) : (
              <div className="flex items-center gap-2 rounded-lg border bg-background/90 px-3 py-1.5 shadow-md backdrop-blur-sm">
                <span className="text-xs font-medium text-amber-600">Đang vẽ — dbl-click để kết thúc</span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setMarkStatusDraw('in_progress')}
                    className={`rounded px-2 py-0.5 text-xs font-medium border transition ${markStatusDraw === 'in_progress' ? 'bg-amber-400 text-white border-amber-400' : 'hover:bg-muted'}`}
                  >
                    Đang thi công
                  </button>
                  <button
                    type="button"
                    onClick={() => setMarkStatusDraw('completed')}
                    className={`rounded px-2 py-0.5 text-xs font-medium border transition ${markStatusDraw === 'completed' ? 'bg-emerald-500 text-white border-emerald-500' : 'hover:bg-muted'}`}
                  >
                    Hoàn thành
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDrawingMark(false)}
                  className="ml-1 rounded px-2 py-0.5 text-xs border hover:bg-muted"
                >
                  Hủy
                </button>
              </div>
            )}
          </div>

          {/* Filter chips */}
          <div className="absolute bottom-16 left-4 z-10 flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => setFilterStatusLocal(null)}
              className={`rounded-full border px-2.5 py-0.5 text-xs font-medium backdrop-blur-sm ${!filterStatus ? 'bg-foreground text-background' : 'bg-background/80 hover:bg-background'}`}
            >
              Tất cả
            </button>
            {ZONE_STATUS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setFilterStatusLocal(s)}
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
            <p className="mb-0.5 font-medium">Chú thích</p>
            {ZONE_STATUS.map((s) => (
              <div key={s} className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: ZONE_STATUS_COLOR[s] }} />
                {STATUS_LABELS[s]}
              </div>
            ))}
            <div className="mt-1 border-t pt-1">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-amber-400 opacity-80" />
                Tô — đang thi công
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500 opacity-80" />
                Tô — hoàn thành
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar — zone list (chỉ zone của mình) */}
        <aside className="flex w-80 flex-col border-l bg-card">
          <div className="border-b px-4 py-3">
            <p className="font-semibold">Khu vực của tôi</p>
            <p className="text-sm text-muted-foreground">{ownZones.length} khu vực được giao</p>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {ownZones.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">Chưa có khu vực nào được giao cho bạn.</p>
            ) : (
              <ul>
                {(filterStatus ? ownZones.filter((z) => z.status === filterStatus) : ownZones).map((zone) => {
                  const color = ZONE_STATUS_COLOR[zone.status] ?? '#9CA3AF'
                  return (
                    <li key={zone.id}>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2.5 border-b px-4 py-2 text-left text-sm hover:bg-muted/40"
                        onClick={() => setZonePopup({ zone, x: 320, y: 120 })}
                      >
                        <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: color }} />
                        <span className="flex-1 truncate">{zone.name}</span>
                        <span className="text-xs text-muted-foreground">{zone.completion_pct}%</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {/* Hint */}
          <div className="border-t p-3 text-xs text-muted-foreground">
            <p>• Click vào khu vực của bạn trên bản vẽ để cập nhật tiến độ.</p>
            <p className="mt-1">• Nhấn "Tô tiến độ" để vẽ vùng đã thi công.</p>
          </div>
        </aside>
      </div>

      {/* Close popups on outside click — handled in canvas */}
    </div>
  )
}
