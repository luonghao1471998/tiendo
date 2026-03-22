import { fabric } from 'fabric'
import { useEffect, useRef } from 'react'

import { ZONE_STATUS_COLOR, MARK_STATUS_COLOR } from '@/lib/constants'
import useCanvasStore from '@/stores/canvasStore'
import type { Geometry } from '@/stores/canvasStore'

interface PolygonLayerProps {
  widthPx: number
  heightPx: number
  /** 'editor' | 'progress' | 'view' */
  canvasMode: 'editor' | 'progress' | 'view'
  currentUserId?: number | null
  /** Draw mode (editor only) */
  drawMode?: boolean
  drawShape?: 'polygon' | 'rect'
  onDrawComplete?: (geometry: Geometry) => void
}

// ─── Helpers (module-level, no closure issues) ──────────────────────────────

function toAbsPoint(p: unknown, w: number, h: number): fabric.Point | null {
  if (Array.isArray(p) && p.length >= 2) {
    const px = Number(p[0])
    const py = Number(p[1])
    if (!Number.isFinite(px) || !Number.isFinite(py)) return null
    return new fabric.Point(px * w, py * h)
  }
  if (p && typeof p === 'object' && 'x' in p && 'y' in p) {
    const px = Number((p as { x: unknown }).x)
    const py = Number((p as { y: unknown }).y)
    if (!Number.isFinite(px) || !Number.isFinite(py)) return null
    return new fabric.Point(px * w, py * h)
  }
  return null
}

function toAbsPoints(geometry: Geometry, w: number, h: number): fabric.Point[] {
  if (geometry.type === 'polygon' && geometry.points) {
    return (geometry.points as unknown[])
      .map((p) => toAbsPoint(p, w, h))
      .filter((pt): pt is fabric.Point => pt !== null)
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

// ─── Component ──────────────────────────────────────────────────────────────

export default function PolygonLayer({
  widthPx,
  heightPx,
  canvasMode,
  currentUserId,
  drawMode = false,
  drawShape = 'polygon',
  onDrawComplete,
}: PolygonLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fabricRef = useRef<fabric.Canvas | null>(null)

  const zones = useCanvasStore((s) => s.zones)
  const marks = useCanvasStore((s) => s.marks)
  const selectedZoneId = useCanvasStore((s) => s.selectedZoneId)
  const filterStatus = useCanvasStore((s) => s.filterStatus)
  const { selectZone, selectMark } = useCanvasStore()

  // ── Effect 1: Init Fabric canvas ──────────────────────────────────────

  useEffect(() => {
    if (!canvasRef.current) return
    const fc = new fabric.Canvas(canvasRef.current, {
      selection: false,
      renderOnAddRemove: false,
      skipTargetFind: canvasMode === 'view' && !drawMode,
    })
    fabricRef.current = fc
    return () => {
      fc.dispose()
      fabricRef.current = null
    }
  // canvasMode changes mean we need to recreate the canvas (skipTargetFind changes)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasMode])

  // ── Effect 2: Render zones + marks ────────────────────────────────────

  useEffect(() => {
    const fc = fabricRef.current
    if (!fc) return

    fc.clear()

    const visibleZones = filterStatus ? zones.filter((z) => z.status === filterStatus) : zones

    for (const zone of visibleZones) {
      const pts = toAbsPoints(zone.geometry_pct, widthPx, heightPx)
      if (pts.length < 2) continue

      const color = ZONE_STATUS_COLOR[zone.status] ?? '#9CA3AF'
      const isSelected = zone.id === selectedZoneId
      const isOwn = zone.assigned_user_id === currentUserId

      const opacity =
        canvasMode === 'progress' && currentUserId != null && !isOwn ? 0.08 : 1

      const poly = new fabric.Polygon(pts, {
        fill: zone.status === 'not_started' ? 'transparent' : hexWithAlpha(color, 0.15),
        stroke: color,
        strokeWidth: isSelected ? 3 : 2,
        strokeDashArray: isSelected ? [6, 3] : undefined,
        opacity,
        selectable: !drawMode && canvasMode !== 'view',
        hasControls: false,
        hasBorders: false,
        evented: true,
        data: { type: 'zone', id: zone.id, isOwn },
      })
      fc.add(poly)

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
          evented: true,
          data: { type: 'mark', id: mark.id },
        }),
      )
    }

    fc.renderAll()
  }, [zones, marks, selectedZoneId, filterStatus, widthPx, heightPx, canvasMode, currentUserId, drawMode])

  // ── Effect 3: Event handlers (selection OR draw mode) ─────────────────

  useEffect(() => {
    const fc = fabricRef.current
    if (!fc) return

    // Remove all previous handlers first
    fc.off('mouse:down')
    fc.off('mouse:dblclick')
    fc.off('mouse:move')
    fc.off('mouse:up')

    if (!drawMode) {
      // ── Selection mode ─────────────────────────────────────────────
      const onMouseDown = (e: fabric.IEvent<Event>) => {
        const target = e.target as (fabric.Object & {
          data?: { type?: string; id?: number }
        }) | null
        if (!target?.data) { selectZone(null); return }
        if (target.data.type === 'zone') selectZone(target.data.id ?? null)
        if (target.data.type === 'mark') selectMark(target.data.id ?? null)
      }
      fc.on('mouse:down', onMouseDown)
      return () => { fc.off('mouse:down', onMouseDown) }
    }

    if (drawShape === 'polygon') {
      // ── Polygon draw mode ─────────────────────────────────────────
      const drawPts: { x: number; y: number }[] = []
      let previewLine: fabric.Polyline | null = null
      let previewPoly: fabric.Polygon | null = null

      const clearPreview = () => {
        if (previewLine) { fc.remove(previewLine); previewLine = null }
        if (previewPoly) { fc.remove(previewPoly); previewPoly = null }
      }

      const renderPreview = () => {
        clearPreview()
        if (drawPts.length < 2) return
        const color = '#3B82F6'
        previewLine = new fabric.Polyline(drawPts, {
          stroke: color, strokeWidth: 2, strokeDashArray: [6, 4],
          fill: 'transparent', selectable: false, evented: false,
        })
        fc.add(previewLine)
        if (drawPts.length >= 3) {
          previewPoly = new fabric.Polygon(drawPts as { x: number; y: number }[], {
            fill: hexWithAlpha(color, 0.15), stroke: 'transparent',
            selectable: false, evented: false,
          })
          fc.add(previewPoly)
        }
        fc.renderAll()
      }

      const onMouseDown = (e: fabric.IEvent<Event>) => {
        const ptr = fc.getPointer(e.e)
        drawPts.push({ x: ptr.x, y: ptr.y })
        renderPreview()
      }

      const onDblClick = () => {
        // Second mousedown of dblclick added an extra point — remove it
        drawPts.pop()
        if (drawPts.length < 3) {
          clearPreview()
          drawPts.length = 0
          fc.renderAll()
          return
        }
        const geometry: Geometry = {
          type: 'polygon',
          points: drawPts.map((p) => [p.x / widthPx, p.y / heightPx] as [number, number]),
        }
        clearPreview()
        drawPts.length = 0
        fc.renderAll()
        onDrawComplete?.(geometry)
      }

      fc.on('mouse:down', onMouseDown)
      fc.on('mouse:dblclick', onDblClick)

      return () => {
        fc.off('mouse:down', onMouseDown)
        fc.off('mouse:dblclick', onDblClick)
        clearPreview()
      }
    }

    if (drawShape === 'rect') {
      // ── Rect draw mode ────────────────────────────────────────────
      let rectStart: { x: number; y: number } | null = null
      let previewRect: fabric.Rect | null = null

      const clearPreview = () => {
        if (previewRect) { fc.remove(previewRect); previewRect = null }
      }

      const onMouseDown = (e: fabric.IEvent<Event>) => {
        const ptr = fc.getPointer(e.e)
        rectStart = { x: ptr.x, y: ptr.y }
      }

      const onMouseMove = (e: fabric.IEvent<Event>) => {
        if (!rectStart) return
        const ptr = fc.getPointer(e.e)
        clearPreview()
        const x = Math.min(rectStart.x, ptr.x)
        const y = Math.min(rectStart.y, ptr.y)
        const w = Math.abs(ptr.x - rectStart.x)
        const h = Math.abs(ptr.y - rectStart.y)
        previewRect = new fabric.Rect({
          left: x, top: y, width: w, height: h,
          fill: 'rgba(59,130,246,0.1)',
          stroke: '#3B82F6', strokeWidth: 2, strokeDashArray: [6, 4],
          selectable: false, evented: false,
        })
        fc.add(previewRect)
        fc.renderAll()
      }

      const onMouseUp = (e: fabric.IEvent<Event>) => {
        if (!rectStart) return
        const ptr = fc.getPointer(e.e)
        const w = Math.abs(ptr.x - rectStart.x)
        const h = Math.abs(ptr.y - rectStart.y)
        const start = { ...rectStart }
        rectStart = null
        clearPreview()
        fc.renderAll()

        if (w < 10 || h < 10) return // too small to be a real zone

        const geometry: Geometry = {
          type: 'rect',
          x: Math.min(start.x, ptr.x) / widthPx,
          y: Math.min(start.y, ptr.y) / heightPx,
          width: w / widthPx,
          height: h / heightPx,
        }
        onDrawComplete?.(geometry)
      }

      fc.on('mouse:down', onMouseDown)
      fc.on('mouse:move', onMouseMove)
      fc.on('mouse:up', onMouseUp)

      return () => {
        fc.off('mouse:down', onMouseDown)
        fc.off('mouse:move', onMouseMove)
        fc.off('mouse:up', onMouseUp)
        clearPreview()
      }
    }
  }, [drawMode, drawShape, onDrawComplete, widthPx, heightPx, canvasMode, selectZone, selectMark])

  // ── Effect 4: Cursor sync ─────────────────────────────────────────────

  useEffect(() => {
    const fc = fabricRef.current
    if (!fc) return
    if (drawMode) {
      fc.defaultCursor = 'crosshair'
      fc.hoverCursor = 'crosshair'
    } else {
      fc.defaultCursor = 'default'
      fc.hoverCursor = canvasMode === 'view' ? 'pointer' : 'move'
    }
  }, [drawMode, canvasMode])

  return (
    <canvas
      ref={canvasRef}
      width={widthPx}
      height={heightPx}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'all' }}
    />
  )
}
