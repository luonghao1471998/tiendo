import { MousePointer2, Pentagon, RectangleHorizontal } from 'lucide-react'

export type CanvasDrawMode = 'select' | 'draw_polygon' | 'draw_rect'

interface CanvasToolbarProps {
  mode: CanvasDrawMode
  onModeChange: (mode: CanvasDrawMode) => void
}

type Tool = { mode: CanvasDrawMode; icon: React.ReactNode; label: string }

const TOOLS: Tool[] = [
  { mode: 'select', icon: <MousePointer2 size={16} />, label: 'Chọn' },
  { mode: 'draw_polygon', icon: <Pentagon size={16} />, label: 'Đa giác' },
  { mode: 'draw_rect', icon: <RectangleHorizontal size={16} />, label: 'Chữ nhật' },
]

export default function CanvasToolbar({ mode, onModeChange }: CanvasToolbarProps) {
  return (
    <div className="flex items-center gap-1 rounded-xl border border-[#E2E8F0] bg-white p-1 shadow-md">
      {TOOLS.map((tool, idx) => (
        <div key={tool.mode} className="flex items-center">
          {idx === 1 ? <div className="mx-0.5 h-5 w-px bg-[#E2E8F0]" /> : null}
          <button
            type="button"
            onClick={() => onModeChange(tool.mode)}
            title={tool.label}
            className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg transition-all duration-150 ${
              mode === tool.mode
                ? 'bg-[#FFF3E8] text-[#FF7F29]'
                : 'text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0F172A]'
            }`}
          >
            {tool.icon}
          </button>
        </div>
      ))}
    </div>
  )
}
