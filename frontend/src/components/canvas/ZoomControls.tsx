import { Maximize2, Minus, Plus } from 'lucide-react'

import useCanvasStore from '@/stores/canvasStore'

export default function ZoomControls() {
  const zoom = useCanvasStore((s) => s.zoom)
  const { setZoom, setPan, resetViewport } = useCanvasStore()

  const zoomIn = () => setZoom(Math.min(zoom * 1.25, 10))
  const zoomOut = () => setZoom(Math.max(zoom / 1.25, 0.1))

  return (
    <div className="flex items-center gap-0.5 rounded-xl border border-[#E2E8F0] bg-white p-1 shadow-md">
      <button
        type="button"
        onClick={zoomOut}
        title="Thu nhỏ"
        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-[#64748B] transition hover:bg-[#F8FAFC] hover:text-[#0F172A]"
      >
        <Minus size={14} />
      </button>

      <span
        className="min-w-[3.5rem] cursor-pointer select-none text-center text-xs font-medium tabular-nums text-[#0F172A] transition hover:text-[#FF7F29]"
        title="Nhấn để về 100%"
        onClick={() => { setZoom(1); setPan(0, 0) }}
      >
        {Math.round(zoom * 100)}%
      </span>

      <button
        type="button"
        onClick={zoomIn}
        title="Phóng to"
        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-[#64748B] transition hover:bg-[#F8FAFC] hover:text-[#0F172A]"
      >
        <Plus size={14} />
      </button>

      <div className="mx-0.5 h-4 w-px bg-[#E2E8F0]" />

      <button
        type="button"
        onClick={resetViewport}
        title="Fit vừa màn hình"
        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-[#64748B] transition hover:bg-[#F8FAFC] hover:text-[#0F172A]"
      >
        <Maximize2 size={14} />
      </button>
    </div>
  )
}
