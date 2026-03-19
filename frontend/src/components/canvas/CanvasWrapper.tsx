import {
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'

import useCanvasStore from '@/stores/canvasStore'

interface CanvasWrapperProps {
  /** Natural pixel dimensions of the layer (from API) */
  widthPx: number
  heightPx: number
  children: ReactNode
}

export default function CanvasWrapper({ widthPx, heightPx, children }: CanvasWrapperProps) {
  const { zoom, panX, panY, setZoom, setPan, resetViewport } = useCanvasStore()

  const outerRef = useRef<HTMLDivElement>(null)
  const isPanning = useRef(false)
  const [panningCursor, setPanningCursor] = useState(false)
  const panStart = useRef({ x: 0, y: 0 })
  const panOrigin = useRef({ x: 0, y: 0 })

  // Fit the canvas to the viewport on first mount (only once when dimensions arrive)
  const fittedRef = useRef(false)
  useLayoutEffect(() => {
    if (fittedRef.current) return
    if (!outerRef.current || widthPx === 0 || heightPx === 0) return
    const { clientWidth, clientHeight } = outerRef.current
    const scale = Math.min(clientWidth / widthPx, clientHeight / heightPx, 1)
    useCanvasStore.getState().setZoom(scale)
    useCanvasStore.getState().setPan(0, 0)
    fittedRef.current = true
  }, [widthPx, heightPx])

  // Reset on unmount so next open starts fresh
  useEffect(() => {
    return () => resetViewport()
  }, [resetViewport])

  // Wheel → zoom around cursor
  const onWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault()
      const delta = e.deltaY < 0 ? 1.1 : 1 / 1.1
      const newZoom = Math.min(Math.max(zoom * delta, 0.1), 10)

      // Zoom around the cursor position
      if (outerRef.current) {
        const rect = outerRef.current.getBoundingClientRect()
        const cx = e.clientX - rect.left - rect.width / 2
        const cy = e.clientY - rect.top - rect.height / 2
        const factor = newZoom / zoom
        const newPanX = cx - factor * (cx - panX)
        const newPanY = cy - factor * (cy - panY)
        setZoom(newZoom)
        setPan(newPanX, newPanY)
      }
    },
    [zoom, panX, panY, setZoom, setPan],
  )

  useEffect(() => {
    const el = outerRef.current
    if (!el) return
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [onWheel])

  // Mouse pan (middle-button or space+drag)
  const onMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Middle mouse button OR Space held (we'll check window state)
      if (e.button !== 1 && !e.altKey) return
      e.preventDefault()
      isPanning.current = true
      setPanningCursor(true)
      panStart.current = { x: e.clientX, y: e.clientY }
      panOrigin.current = { x: panX, y: panY }
    },
    [panX, panY],
  )

  const onMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isPanning.current) return
      const dx = e.clientX - panStart.current.x
      const dy = e.clientY - panStart.current.y
      setPan(panOrigin.current.x + dx, panOrigin.current.y + dy)
    },
    [setPan],
  )

  const stopPan = useCallback(() => {
    isPanning.current = false
    setPanningCursor(false)
  }, [])

  return (
    <div
      ref={outerRef}
      className="relative overflow-hidden bg-neutral-800"
      style={{ width: '100%', height: '100%', cursor: panningCursor ? 'grabbing' : 'default' }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={stopPan}
      onMouseLeave={stopPan}
    >
      {/* Transformed inner container */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: widthPx,
          height: heightPx,
          transform: `translate(-50%, -50%) translate(${panX}px, ${panY}px) scale(${zoom})`,
          transformOrigin: 'center center',
        }}
      >
        {children}
      </div>
    </div>
  )
}
