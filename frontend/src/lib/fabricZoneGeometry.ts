import { fabric } from 'fabric'

import type { Geometry } from '@/stores/canvasStore'

/** Điểm polygon trên canvas (pixel layer). */
export type CanvasPoint = { x: number; y: number }

export function geometryToCanvasPoints(geometry: Geometry, w: number, h: number): CanvasPoint[] {
  if (geometry.type === 'polygon' && geometry.points?.length) {
    return geometry.points.map(([px, py]) => ({ x: px * w, y: py * h }))
  }
  if (geometry.type === 'rect') {
    const x = geometry.x ?? 0
    const y = geometry.y ?? 0
    const rw = geometry.width ?? 0
    const rh = geometry.height ?? 0
    return [
      { x: x * w, y: y * h },
      { x: (x + rw) * w, y: y * h },
      { x: (x + rw) * w, y: (y + rh) * h },
      { x: x * w, y: (y + rh) * h },
    ]
  }
  return []
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0
  return Math.min(1, Math.max(0, v))
}

/** Chuẩn hóa pixel canvas → geometry_pct [0,1] (phòng làm tròn / lệch nhẹ sau transform Fabric). */
export function canvasPointsToGeometry(points: CanvasPoint[], w: number, h: number): Geometry {
  if (w <= 0 || h <= 0) {
    return { type: 'polygon', points: [] }
  }
  return {
    type: 'polygon',
    points: points.map((p) => [clamp01(p.x / w), clamp01(p.y / h)] as [number, number]),
  }
}

/** Lấy đỉnh polygon trong không gian canvas (đã áp transform của object). */
export function getPolygonAbsoluteCanvasPoints(poly: fabric.Polygon): CanvasPoint[] {
  const pts = poly.points ?? []
  const matrix = poly.calcTransformMatrix()
  const ox = poly.pathOffset?.x ?? 0
  const oy = poly.pathOffset?.y ?? 0
  return pts.map((p) => {
    const tp = fabric.util.transformPoint(new fabric.Point(p.x - ox, p.y - oy), matrix)
    return { x: tp.x, y: tp.y }
  })
}

/**
 * Polygon nằm trong Group (kéo cả vùng).
 * `poly.calcTransformMatrix()` (mặc định) đã gồm transform của parent group — không nhân thêm `group` (tránh double transform → tọa độ sai, 422 geometry_pct).
 */
export function getGroupedPolygonCanvasPoints(_group: fabric.Group, poly: fabric.Polygon): CanvasPoint[] {
  return getPolygonAbsoluteCanvasPoints(poly)
}
