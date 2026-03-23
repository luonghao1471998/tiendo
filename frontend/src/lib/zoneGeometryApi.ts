import type { Geometry } from '@/stores/canvasStore'

/** Payload `geometry_pct` cho POST zone / PUT zone (API Laravel). */
export function toApiGeometryPct(geo: Geometry): { type: 'polygon'; points: { x: number; y: number }[] } {
  let rawPoints: [number, number][]
  if (geo.type === 'rect') {
    const x = geo.x ?? 0
    const y = geo.y ?? 0
    const w = geo.width ?? 0
    const h = geo.height ?? 0
    rawPoints = [
      [x, y],
      [x + w, y],
      [x + w, y + h],
      [x, y + h],
    ]
  } else {
    rawPoints = (geo.points ?? []) as [number, number][]
  }
  return { type: 'polygon', points: rawPoints.map(([px, py]) => ({ x: px, y: py })) }
}
