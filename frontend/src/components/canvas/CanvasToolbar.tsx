export type CanvasDrawMode = 'select' | 'draw_polygon' | 'draw_rect'

interface CanvasToolbarProps {
  mode: CanvasDrawMode
  onModeChange: (mode: CanvasDrawMode) => void
}

export default function CanvasToolbar({ mode, onModeChange }: CanvasToolbarProps) {
  const btn = (m: CanvasDrawMode, label: string) => (
    <button
      key={m}
      type="button"
      onClick={() => onModeChange(m)}
      className={`rounded px-3 py-1.5 text-xs font-medium transition ${
        mode === m ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="flex items-center gap-1 rounded-lg border bg-background/90 p-1 shadow-md backdrop-blur-sm">
      {btn('select', '↖ Chọn')}
      <div className="mx-1 h-4 w-px bg-border" />
      {btn('draw_polygon', '⬡ Đa giác')}
      {btn('draw_rect', '▭ Chữ nhật')}
    </div>
  )
}
