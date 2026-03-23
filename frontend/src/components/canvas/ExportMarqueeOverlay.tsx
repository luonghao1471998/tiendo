import { useCallback, useEffect, useState } from 'react'

/** Parent nên đặt `key` tăng dần mỗi lần mở để reset state nội bộ. */

import type { PdfCropRect } from '@/lib/canvasPdfExport'

type Props = {
  active: boolean
  widthPx: number
  heightPx: number
  mapTargetEl: HTMLElement | null
  onCancel: () => void
  onComplete: (crop: PdfCropRect) => void
}

/**
 * Kéo thả chọn hình chữ nhật; map sang pixel layer qua getBoundingClientRect của canvas Fabric.
 */
export default function ExportMarqueeOverlay({
  active,
  widthPx,
  heightPx,
  mapTargetEl,
  onCancel,
  onComplete,
}: Props) {
  const [start, setStart] = useState<{ x: number; y: number } | null>(null)
  const [curr, setCurr] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, onCancel])

  const finish = useCallback(() => {
    if (!start || !curr || !mapTargetEl) {
      setStart(null)
      setCurr(null)
      return
    }

    const r = mapTargetEl.getBoundingClientRect()
    if (r.width <= 0 || r.height <= 0) {
      setStart(null)
      setCurr(null)
      onCancel()
      return
    }

    const sx = ((Math.min(start.x, curr.x) - r.left) / r.width) * widthPx
    const sy = ((Math.min(start.y, curr.y) - r.top) / r.height) * heightPx
    const sw = (Math.abs(curr.x - start.x) / r.width) * widthPx
    const sh = (Math.abs(curr.y - start.y) / r.height) * heightPx

    const left = Math.max(0, Math.floor(sx))
    const top = Math.max(0, Math.floor(sy))
    const w = Math.min(widthPx - left, Math.ceil(sw))
    const h = Math.min(heightPx - top, Math.ceil(sh))

    setStart(null)
    setCurr(null)

    const minPx = 24
    if (w < minPx || h < minPx) {
      onCancel()
      return
    }
    onComplete({ x: left, y: top, w, h })
  }, [start, curr, mapTargetEl, widthPx, heightPx, onComplete, onCancel])

  if (!active) return null

  let box: { left: number; top: number; width: number; height: number } | null = null
  if (start && curr) {
    box = {
      left: Math.min(start.x, curr.x),
      top: Math.min(start.y, curr.y),
      width: Math.abs(curr.x - start.x),
      height: Math.abs(curr.y - start.y),
    }
  }

  return (
    <div
      className="absolute inset-0 z-[45] cursor-crosshair bg-black/30"
      style={{ touchAction: 'none' }}
      onPointerDown={(e) => {
        e.preventDefault()
        e.stopPropagation()
        setStart({ x: e.clientX, y: e.clientY })
        setCurr({ x: e.clientX, y: e.clientY })
        ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      }}
      onPointerMove={(e) => {
        if (!start) return
        e.preventDefault()
        setCurr({ x: e.clientX, y: e.clientY })
      }}
      onPointerUp={(e) => {
        e.preventDefault()
        try {
          ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
        } catch {
          /* ignore */
        }
        finish()
      }}
      onPointerCancel={() => {
        setStart(null)
        setCurr(null)
        onCancel()
      }}
    >
      <div className="pointer-events-none absolute left-0 right-0 top-3 text-center text-xs font-semibold text-white drop-shadow-md">
        Kéo thả chọn vùng · Esc hủy
      </div>
      {box && box.width > 2 && box.height > 2 ? (
        <div
          className="pointer-events-none fixed z-[46] border-2 border-dashed border-[#FF7F29] bg-[#FF7F29]/20"
          style={{
            left: box.left,
            top: box.top,
            width: box.width,
            height: box.height,
          }}
        />
      ) : null}
    </div>
  )
}
