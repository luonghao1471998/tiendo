const TILE_SIZE = 1024

interface TileLayerProps {
  layerId: number
  widthPx: number
  heightPx: number
}

/**
 * Renders the layer background as a grid of <img> tiles.
 * Tile path convention: GET /api/v1/layers/{id}/tiles/0_{x}_{y}.jpg
 * Tiles are 1024x1024 JPEG. x, y are tile column/row indices (0-based).
 */
export default function TileLayer({ layerId, widthPx, heightPx }: TileLayerProps) {
  const cols = Math.ceil(widthPx / TILE_SIZE)
  const rows = Math.ceil(heightPx / TILE_SIZE)

  const tiles: { x: number; y: number; left: number; top: number; w: number; h: number }[] = []

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const left = col * TILE_SIZE
      const top = row * TILE_SIZE
      const w = Math.min(TILE_SIZE, widthPx - left)
      const h = Math.min(TILE_SIZE, heightPx - top)
      tiles.push({ x: col, y: row, left, top, w, h })
    }
  }

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        width: widthPx,
        height: heightPx,
        userSelect: 'none',
      }}
    >
      {tiles.map(({ x, y, left, top, w, h }) => (
        <img
          key={`${x}_${y}`}
          src={`/api/v1/layers/${layerId}/tiles/0_${x}_${y}.jpg`}
          alt=""
          draggable={false}
          style={{
            position: 'absolute',
            left,
            top,
            width: w,
            height: h,
            display: 'block',
          }}
        />
      ))}
    </div>
  )
}
