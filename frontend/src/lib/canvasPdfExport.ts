import { fabric } from 'fabric'
import { jsPDF } from 'jspdf'

const TILE_SIZE = 1024

function tileSrc(layerId: number, col: number, row: number): string {
  return `/api/v1/layers/${layerId}/tiles/0/${col}/${row}`
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Không tải được ảnh: ${url}`))
    img.src = url
  })
}

/** Vẽ lưới tile JPEG lên context (cùng logic TileLayer). */
export async function drawTilesOnContext(
  ctx: CanvasRenderingContext2D,
  layerId: number,
  widthPx: number,
  heightPx: number,
): Promise<void> {
  const cols = Math.ceil(widthPx / TILE_SIZE)
  const rows = Math.ceil(heightPx / TILE_SIZE)
  ctx.fillStyle = '#f5f5f5'
  ctx.fillRect(0, 0, widthPx, heightPx)

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const left = col * TILE_SIZE
      const top = row * TILE_SIZE
      const w = Math.min(TILE_SIZE, widthPx - left)
      const h = Math.min(TILE_SIZE, heightPx - top)
      try {
        const img = await loadImage(tileSrc(layerId, col, row))
        ctx.drawImage(img, left, top, w, h)
      } catch {
        ctx.fillStyle = '#e5e5e5'
        ctx.fillRect(left, top, w, h)
      }
    }
  }
}

/**
 * Ghép nền tile + overlay Fabric (zones/marks) đúng như trên màn hình.
 */
export async function compositeLayerToCanvas(
  layerId: number,
  widthPx: number,
  heightPx: number,
  fabricCanvas: fabric.Canvas | null,
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas')
  canvas.width = widthPx
  canvas.height = heightPx
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Không tạo được canvas 2D.')
  }

  await drawTilesOnContext(ctx, layerId, widthPx, heightPx)

  if (fabricCanvas) {
    fabricCanvas.renderAll()
    const dataUrl = fabricCanvas.toDataURL({
      format: 'png',
      multiplier: 1,
    })
    await new Promise<void>((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        ctx.drawImage(img, 0, 0, widthPx, heightPx)
        resolve()
      }
      img.onerror = () => reject(new Error('Không ghép được lớp zone/mark.'))
      img.src = dataUrl
    })
  }

  return canvas
}

export type PdfCropRect = { x: number; y: number; w: number; h: number }

/** Xuất PDF một trang, kích thước trang = ảnh (hoặc vùng crop). */
export function downloadCanvasAsPdf(canvas: HTMLCanvasElement, filename: string, crop?: PdfCropRect): void {
  let src = canvas
  if (crop && (crop.w > 0 && crop.h > 0)) {
    const x = Math.max(0, Math.floor(crop.x))
    const y = Math.max(0, Math.floor(crop.y))
    const w = Math.min(canvas.width - x, Math.max(1, Math.floor(crop.w)))
    const h = Math.min(canvas.height - y, Math.max(1, Math.floor(crop.h)))
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const cx = c.getContext('2d')
    if (!cx) throw new Error('Crop canvas failed')
    cx.drawImage(canvas, x, y, w, h, 0, 0, w, h)
    src = c
  }

  const imgData = src.toDataURL('image/png', 1.0)
  const w = src.width
  const h = src.height

  const pdf = new jsPDF({
    orientation: w >= h ? 'landscape' : 'portrait',
    unit: 'px',
    format: [w, h],
    hotfixes: ['px_scaling'],
  })
  pdf.addImage(imgData, 'PNG', 0, 0, w, h, undefined, 'FAST')
  pdf.save(filename)
}

export async function exportLayerPdf(
  layerId: number,
  widthPx: number,
  heightPx: number,
  fabricCanvas: fabric.Canvas | null,
  filename: string,
  crop?: PdfCropRect,
): Promise<void> {
  const composite = await compositeLayerToCanvas(layerId, widthPx, heightPx, fabricCanvas)
  try {
    downloadCanvasAsPdf(composite, filename, crop)
  } finally {
    // release
    composite.width = 0
    composite.height = 0
  }
}
