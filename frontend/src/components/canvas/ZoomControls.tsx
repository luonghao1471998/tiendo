import useCanvasStore from '@/stores/canvasStore'

export default function ZoomControls() {
  const zoom = useCanvasStore((s) => s.zoom)
  const { setZoom, setPan, resetViewport } = useCanvasStore()

  const zoomIn = () => setZoom(Math.min(zoom * 1.25, 10))
  const zoomOut = () => setZoom(Math.max(zoom / 1.25, 0.1))
  const fit = () => {
    resetViewport()
  }

  return (
    <div className="flex items-center gap-1 rounded-lg border bg-background/90 p-1 shadow-md backdrop-blur-sm">
      <button
        type="button"
        onClick={zoomOut}
        className="rounded px-2 py-1 text-sm font-medium hover:bg-muted"
        title="Thu nhỏ"
      >
        −
      </button>
      <span
        className="min-w-[4rem] cursor-pointer select-none text-center text-xs tabular-nums hover:underline"
        title="Nhấn để về 100%"
        onClick={() => {
          setZoom(1)
          setPan(0, 0)
        }}
      >
        {Math.round(zoom * 100)}%
      </span>
      <button
        type="button"
        onClick={zoomIn}
        className="rounded px-2 py-1 text-sm font-medium hover:bg-muted"
        title="Phóng to"
      >
        +
      </button>
      <div className="mx-1 h-4 w-px bg-border" />
      <button
        type="button"
        onClick={fit}
        className="rounded px-2 py-1 text-xs hover:bg-muted"
        title="Fit vừa màn hình"
      >
        Fit
      </button>
    </div>
  )
}
