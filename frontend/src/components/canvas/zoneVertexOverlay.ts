import { fabric } from 'fabric'

import {
  type CanvasPoint,
  canvasPointsToGeometry,
  geometryToCanvasPoints,
} from '@/lib/fabricZoneGeometry'
import type { Geometry } from '@/stores/canvasStore'

/** Đồng bộ với PolygonLayer: khi redraw layer, giữ object có tag này để không mất overlay khi đổi selection. */
export const ZONE_VERTEX_EDIT_TAG = 'vertex-edit'
const TAG = ZONE_VERTEX_EDIT_TAG

function mark(o: fabric.Object) {
  ;(o as fabric.Object & { data?: { tag?: string } }).data = { ...(o as fabric.Object & { data?: object }).data, tag: TAG }
}

function isTagged(o: fabric.Object | undefined): boolean {
  return (o as fabric.Object & { data?: { tag?: string } })?.data?.tag === TAG
}

export type VertexOverlayApi = {
  dispose: () => void
  commit: () => void
  cancel: () => void
}

/**
 * Chế độ sửa đỉnh zone: đỉnh đỏ, trung điểm xanh (double-click chèn), chuột phải đỉnh xóa (giữ tối thiểu 3 đỉnh).
 * Viền polygon dùng **tọa độ tuyệt đối** giống PolygonLayer (không centroid+left/top) để khớp với zone trên canvas.
 * Ctrl+Z / Ctrl+Shift+Z (hoặc Ctrl+Y) undo/redo cục bộ. Esc / Hủy gọi onCancel.
 */
export function attachZoneVertexOverlay(
  fc: fabric.Canvas,
  initialGeometry: Geometry,
  widthPx: number,
  heightPx: number,
  onCommit: (g: Geometry) => void,
  onCancel?: () => void,
): VertexOverlayApi {
  let points: CanvasPoint[] = geometryToCanvasPoints(initialGeometry, widthPx, heightPx).map((p) => ({ ...p }))
  const past: CanvasPoint[][] = []
  const future: CanvasPoint[][] = []

  const snap = (): CanvasPoint[] => points.map((p) => ({ ...p }))

  const pushUndo = () => {
    past.push(snap())
    future.length = 0
    if (past.length > 50) past.shift()
  }

  const applyPoints = (next: CanvasPoint[]) => {
    points = next.map((p) => ({ ...p }))
    redrawAll()
  }

  const undo = () => {
    if (past.length === 0) return
    future.push(snap())
    const prev = past.pop()
    if (prev) applyPoints(prev)
  }

  const redo = () => {
    if (future.length === 0) return
    past.push(snap())
    const n = future.pop()
    if (n) applyPoints(n)
  }

  let outline: fabric.Polygon | null = null
  const vertexCircles: fabric.Circle[] = []
  const midCircles: fabric.Circle[] = []

  const removeHandles = () => {
    vertexCircles.splice(0).forEach((c) => fc.remove(c))
    midCircles.splice(0).forEach((c) => fc.remove(c))
    if (outline) {
      fc.remove(outline)
      outline = null
    }
  }

  function redrawAll() {
    removeHandles()
    outline = new fabric.Polygon(
      points.map((p) => ({ x: p.x, y: p.y })),
      {
        fill: 'rgba(239,68,68,0.12)',
        stroke: '#EF4444',
        strokeWidth: 2,
        strokeDashArray: [5, 4],
        selectable: false,
        evented: false,
        objectCaching: false,
      },
    )
    mark(outline)
    fc.add(outline)

    points.forEach((p, i) => {
      const cir = new fabric.Circle({
        left: p.x,
        top: p.y,
        radius: 7,
        fill: '#EF4444',
        stroke: '#fff',
        strokeWidth: 2,
        originX: 'center',
        originY: 'center',
        hasControls: false,
        hasBorders: false,
        selectable: true,
        lockRotation: true,
        lockScalingX: true,
        lockScalingY: true,
        hoverCursor: 'move',
        objectCaching: false,
      })
      mark(cir)
      ;(cir as fabric.Circle & { vertexIndex?: number }).vertexIndex = i

      cir.on('mousedown', () => {
        pushUndo()
      })

      cir.on('moving', () => {
        const idx = (cir as fabric.Circle & { vertexIndex?: number }).vertexIndex ?? 0
        points[idx] = { x: cir.left ?? 0, y: cir.top ?? 0 }
        syncOutlineOnly()
        syncMidpointsOnly()
        fc.requestRenderAll()
      })

      cir.on('contextmenu', (ev) => {
        ev.e.preventDefault()
        if (points.length <= 3) return
        pushUndo()
        const idx = (cir as fabric.Circle & { vertexIndex?: number }).vertexIndex ?? 0
        points.splice(idx, 1)
        redrawAll()
        fc.requestRenderAll()
      })

      vertexCircles.push(cir)
      fc.add(cir)
    })

    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length
      const mx = (points[i].x + points[j].x) / 2
      const my = (points[i].y + points[j].y) / 2
      const mid = new fabric.Circle({
        left: mx,
        top: my,
        radius: 5,
        fill: '#3B82F6',
        stroke: '#fff',
        strokeWidth: 1.5,
        originX: 'center',
        originY: 'center',
        selectable: false,
        evented: true,
        hoverCursor: 'copy',
        objectCaching: false,
      })
      mark(mid)
      ;(mid as fabric.Circle & { afterIndex?: number }).afterIndex = i
      mid.on('dblclick', () => {
        const after = (mid as fabric.Circle & { afterIndex?: number }).afterIndex ?? 0
        pushUndo()
        const nx = (points[after].x + points[(after + 1) % points.length].x) / 2
        const ny = (points[after].y + points[(after + 1) % points.length].y) / 2
        points.splice(after + 1, 0, { x: nx, y: ny })
        redrawAll()
        fc.requestRenderAll()
      })
      midCircles.push(mid)
      fc.add(mid)
    }

    fc.requestRenderAll()
  }

  function syncOutlineOnly() {
    if (!outline) return
    outline.set({
      points: points.map((p) => new fabric.Point(p.x, p.y)),
    })
    outline.setCoords()
    outline.set('dirty', true)
  }

  function syncMidpointsOnly() {
    midCircles.forEach((mid) => {
      const i = (mid as fabric.Circle & { afterIndex?: number }).afterIndex ?? 0
      const j = (i + 1) % points.length
      const mx = (points[i].x + points[j].x) / 2
      const my = (points[i].y + points[j].y) / 2
      mid.set({ left: mx, top: my })
      mid.setCoords()
    })
  }

  const onKeyDown = (e: KeyboardEvent) => {
    const mod = e.ctrlKey || e.metaKey
    if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) {
      e.preventDefault()
      undo()
      return
    }
    if (mod && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
      e.preventDefault()
      redo()
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      cancel()
    }
  }

  window.addEventListener('keydown', onKeyDown, true)
  redrawAll()

  let disposed = false

  const dispose = () => {
    if (disposed) return
    disposed = true
    window.removeEventListener('keydown', onKeyDown, true)
    removeHandles()
    fc.getObjects().forEach((o) => {
      if (isTagged(o)) fc.remove(o)
    })
    fc.requestRenderAll()
  }

  const commit = () => {
    if (disposed) return
    const g = canvasPointsToGeometry(points, widthPx, heightPx)
    dispose()
    onCommit(g)
  }

  const cancel = () => {
    if (disposed) return
    dispose()
    onCancel?.()
  }

  return { dispose, commit, cancel }
}
