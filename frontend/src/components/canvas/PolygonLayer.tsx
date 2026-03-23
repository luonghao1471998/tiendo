import { fabric } from 'fabric'
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

import {
  attachZoneVertexOverlay,
  ZONE_VERTEX_EDIT_TAG,
  type VertexOverlayApi,
} from '@/components/canvas/zoneVertexOverlay'
import { ZONE_STATUS_COLOR, MARK_STATUS_COLOR } from '@/lib/constants'
import { canvasPointsToGeometry, getGroupedPolygonCanvasPoints } from '@/lib/fabricZoneGeometry'
import useCanvasStore from '@/stores/canvasStore'
import type { Geometry } from '@/stores/canvasStore'

export type FabricCanvasHandle = {
  getFabric: () => fabric.Canvas | null
  /** Lưu chỉnh sửa đỉnh đang mở (nếu có). */
  commitVertexEdit?: () => boolean
  /** Hủy chỉnh sửa đỉnh (nếu có). */
  cancelVertexEdit?: () => void
}

interface PolygonLayerProps {
  widthPx: number
  heightPx: number
  /** 'editor' | 'progress' | 'view' */
  canvasMode: 'editor' | 'progress' | 'view'
  currentUserId?: number | null
  drawMode?: boolean
  drawShape?: 'polygon' | 'rect'
  onDrawComplete?: (geometry: Geometry) => void
  /** PM/Admin: kéo cả vùng (group) + double-click sửa đỉnh */
  enableZoneDrag?: boolean
  vertexEditZoneId?: number | null
  onVertexEditZoneChange?: (zoneId: number | null) => void
  onZoneGeometryCommit?: (zoneId: number, geometry: Geometry) => Promise<void>
}

type PlainPoint = { x: number; y: number }

function toAbsPoint(p: unknown, w: number, h: number): PlainPoint | null {
  if (Array.isArray(p) && p.length >= 2) {
    const px = Number(p[0])
    const py = Number(p[1])
    if (!Number.isFinite(px) || !Number.isFinite(py)) return null
    return { x: px * w, y: py * h }
  }
  if (p && typeof p === 'object' && 'x' in p && 'y' in p) {
    const px = Number((p as { x: unknown }).x)
    const py = Number((p as { y: unknown }).y)
    if (!Number.isFinite(px) || !Number.isFinite(py)) return null
    return { x: px * w, y: py * h }
  }
  return null
}

function toAbsPoints(geometry: Geometry, w: number, h: number): PlainPoint[] {
  if (geometry.type === 'polygon' && geometry.points) {
    return (geometry.points as unknown[])
      .map((p) => toAbsPoint(p, w, h))
      .filter((pt): pt is PlainPoint => pt !== null)
  }
  if (geometry.type === 'rect') {
    const { x = 0, y = 0, width = 0, height = 0 } = geometry
    return [
      { x: x * w, y: y * h },
      { x: (x + width) * w, y: y * h },
      { x: (x + width) * w, y: (y + height) * h },
      { x: x * w, y: (y + height) * h },
    ]
  }
  return []
}

function centroid(points: PlainPoint[]): { x: number; y: number } {
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

/** Xóa object canvas nhưng giữ overlay sửa đỉnh (tránh mất vùng khi click nền → đổi selectedZoneId → effect redraw). */
function clearFabricLayerExceptVertexOverlay(fc: fabric.Canvas) {
  for (const o of [...fc.getObjects()]) {
    const tag = (o as fabric.Object & { data?: { tag?: string } }).data?.tag
    if (tag === ZONE_VERTEX_EDIT_TAG) continue
    fc.remove(o)
  }
}

function bringVertexOverlayToFront(fc: fabric.Canvas) {
  fc.getObjects().forEach((o) => {
    const tag = (o as fabric.Object & { data?: { tag?: string } }).data?.tag
    if (tag === ZONE_VERTEX_EDIT_TAG) fc.bringToFront(o)
  })
}

const PolygonLayer = forwardRef<FabricCanvasHandle, PolygonLayerProps>(function PolygonLayer(
  {
    widthPx,
    heightPx,
    canvasMode,
    currentUserId,
    drawMode = false,
    drawShape = 'polygon',
    onDrawComplete,
    enableZoneDrag = false,
    vertexEditZoneId = null,
    onVertexEditZoneChange,
    onZoneGeometryCommit,
  },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fabricRef = useRef<fabric.Canvas | null>(null)
  const vertexOverlayRef = useRef<VertexOverlayApi | null>(null)
  const moveDebounceRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())

  const zones = useCanvasStore((s) => s.zones)
  const marks = useCanvasStore((s) => s.marks)
  const selectedZoneId = useCanvasStore((s) => s.selectedZoneId)
  const filterStatus = useCanvasStore((s) => s.filterStatus)
  const { selectZone, selectMark } = useCanvasStore()

  useImperativeHandle(ref, () => ({
    getFabric: () => fabricRef.current,
    commitVertexEdit: () => {
      const v = vertexOverlayRef.current
      if (!v) return false
      v.commit()
      vertexOverlayRef.current = null
      return true
    },
    cancelVertexEdit: () => {
      vertexOverlayRef.current?.cancel()
      vertexOverlayRef.current = null
    },
  }))

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasMode])

  useEffect(() => {
    const fc = fabricRef.current
    if (!fc) return

    if (vertexEditZoneId != null) {
      clearFabricLayerExceptVertexOverlay(fc)
    } else {
      fc.clear()
    }
    moveDebounceRef.current.forEach(clearTimeout)
    moveDebounceRef.current.clear()

    const visibleZones = filterStatus ? zones.filter((z) => z.status === filterStatus) : zones
    const useGroup =
      canvasMode === 'editor' && !drawMode && enableZoneDrag && vertexEditZoneId === null

    for (const zone of visibleZones) {
      if (vertexEditZoneId === zone.id) continue

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
        selectable: !drawMode && canvasMode !== 'view' && !useGroup,
        hasControls: false,
        hasBorders: false,
        evented: true,
        objectCaching: false,
        data: { type: 'zone', id: zone.id, isOwn },
      })

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

      if (useGroup) {
        const group = new fabric.Group([poly, label], {
          selectable: true,
          subTargetCheck: true,
          hasControls: false,
          hasBorders: false,
          lockRotation: true,
          lockScalingX: true,
          lockScalingY: true,
          opacity,
          data: { type: 'zone', id: zone.id, isOwn },
        })
        fc.add(group)
      } else {
        fc.add(poly)
        fc.add(label)
      }
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

    if (vertexEditZoneId != null) {
      bringVertexOverlayToFront(fc)
    }

    fc.renderAll()
  }, [
    zones,
    marks,
    selectedZoneId,
    filterStatus,
    widthPx,
    heightPx,
    canvasMode,
    currentUserId,
    drawMode,
    enableZoneDrag,
    vertexEditZoneId,
  ])

  useEffect(() => {
    const fc = fabricRef.current
    if (!fc) return

    fc.off('mouse:down')
    fc.off('mouse:dblclick')
    fc.off('mouse:move')
    fc.off('mouse:up')
    fc.off('object:modified')

    if (!drawMode) {
      const onMouseDown = (e: fabric.IEvent<Event>) => {
        const target = e.target as (fabric.Object & {
          data?: { type?: string; id?: number }
        }) | null
        if (!target?.data) {
          // Đang sửa đỉnh: click nền không bỏ chọn zone (tránh tưởng "không có gì xảy ra" + mất panel).
          if (vertexEditZoneId != null) {
            selectZone(vertexEditZoneId)
          } else {
            selectZone(null)
          }
          return
        }
        if (target.data.type === 'zone') selectZone(target.data.id ?? null)
        if (target.data.type === 'mark') selectMark(target.data.id ?? null)
      }

      const onDblClick = (e: fabric.IEvent<Event>) => {
        if (!enableZoneDrag || !onVertexEditZoneChange || vertexEditZoneId != null) return
        const raw = e.target as (fabric.Object & { data?: { type?: string; id?: number }; type?: string }) | null
        if (!raw) return
        let id: number | undefined
        let typ: string | undefined
        if (raw.type === 'group' && raw.data?.type === 'zone') {
          id = raw.data.id
          typ = 'zone'
        } else if (raw.data?.type === 'zone') {
          id = raw.data.id
          typ = 'zone'
        }
        if (typ === 'zone' && id != null) onVertexEditZoneChange(id)
      }

      fc.on('mouse:down', onMouseDown)
      fc.on('mouse:dblclick', onDblClick)

      if (enableZoneDrag && onZoneGeometryCommit && vertexEditZoneId === null) {
        const debouncers = moveDebounceRef.current
        const onModified = (opt: fabric.IEvent<Event>) => {
          const t = opt.target as fabric.Group & { data?: { type?: string; id?: number }; type?: string }
          if (!t || t.type !== 'group' || t.data?.type !== 'zone' || t.data.id == null) return
          const poly = t.item(0) as unknown as fabric.Polygon
          if (!poly || poly.type !== 'polygon') return
          const cpts = getGroupedPolygonCanvasPoints(t, poly)
          const zid = t.data.id
          const prev = debouncers.get(zid)
          if (prev) clearTimeout(prev)
          debouncers.set(
            zid,
            setTimeout(() => {
              debouncers.delete(zid)
              void onZoneGeometryCommit(zid, canvasPointsToGeometry(cpts, widthPx, heightPx))
            }, 450),
          )
        }
        fc.on('object:modified', onModified)
      }

      const timersAtMount = moveDebounceRef.current
      return () => {
        fc.off('mouse:down', onMouseDown)
        fc.off('mouse:dblclick', onDblClick)
        fc.off('object:modified')
        timersAtMount.forEach(clearTimeout)
        timersAtMount.clear()
      }
    }

    if (drawShape === 'polygon') {
      const drawPts: { x: number; y: number }[] = []
      let previewLine: fabric.Polyline | null = null
      let previewPoly: fabric.Polygon | null = null

      const clearPreview = () => {
        if (previewLine) {
          fc.remove(previewLine)
          previewLine = null
        }
        if (previewPoly) {
          fc.remove(previewPoly)
          previewPoly = null
        }
      }

      const renderPreview = () => {
        clearPreview()
        if (drawPts.length < 2) return
        const color = '#3B82F6'
        previewLine = new fabric.Polyline(drawPts, {
          stroke: color,
          strokeWidth: 2,
          strokeDashArray: [6, 4],
          fill: 'transparent',
          selectable: false,
          evented: false,
        })
        fc.add(previewLine)
        if (drawPts.length >= 3) {
          previewPoly = new fabric.Polygon(drawPts as { x: number; y: number }[], {
            fill: hexWithAlpha(color, 0.15),
            stroke: 'transparent',
            selectable: false,
            evented: false,
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
      let rectStart: { x: number; y: number } | null = null
      let previewRect: fabric.Rect | null = null

      const clearPreview = () => {
        if (previewRect) {
          fc.remove(previewRect)
          previewRect = null
        }
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
          left: x,
          top: y,
          width: w,
          height: h,
          fill: 'rgba(59,130,246,0.1)',
          stroke: '#3B82F6',
          strokeWidth: 2,
          strokeDashArray: [6, 4],
          selectable: false,
          evented: false,
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

        if (w < 10 || h < 10) return

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
    return undefined
  }, [
    drawMode,
    drawShape,
    onDrawComplete,
    widthPx,
    heightPx,
    canvasMode,
    selectZone,
    selectMark,
    enableZoneDrag,
    onVertexEditZoneChange,
    onZoneGeometryCommit,
    vertexEditZoneId,
  ])

  useEffect(() => {
    const fc = fabricRef.current
    if (!fc || vertexEditZoneId == null || !onZoneGeometryCommit || !onVertexEditZoneChange) {
      vertexOverlayRef.current?.cancel()
      vertexOverlayRef.current = null
      return
    }

    const zone = useCanvasStore.getState().zones.find((z) => z.id === vertexEditZoneId)
    if (!zone) {
      onVertexEditZoneChange(null)
      return
    }

    vertexOverlayRef.current?.cancel()
    const editingId = vertexEditZoneId
    const api = attachZoneVertexOverlay(
      fc,
      zone.geometry_pct,
      widthPx,
      heightPx,
      (geometry) => {
        vertexOverlayRef.current = null
        onVertexEditZoneChange(null)
        void onZoneGeometryCommit(editingId, geometry)
      },
      () => {
        onVertexEditZoneChange(null)
      },
    )
    vertexOverlayRef.current = api

    return () => {
      api.cancel()
      if (vertexOverlayRef.current === api) vertexOverlayRef.current = null
    }
  }, [vertexEditZoneId, widthPx, heightPx, onZoneGeometryCommit, onVertexEditZoneChange])

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
})

export default PolygonLayer
