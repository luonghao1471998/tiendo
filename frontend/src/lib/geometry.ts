export function toPercent(px: number, total: number) {
  if (total === 0) return 0
  return px / total
}

export function fromPercent(pct: number, total: number) {
  return pct * total
}

export function toPercentPoint(
  point: { x: number; y: number },
  width: number,
  height: number,
) {
  return {
    x: toPercent(point.x, width),
    y: toPercent(point.y, height),
  }
}

export function fromPercentPoint(
  point: { x: number; y: number },
  width: number,
  height: number,
) {
  return {
    x: fromPercent(point.x, width),
    y: fromPercent(point.y, height),
  }
}

