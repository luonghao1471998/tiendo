#!/usr/bin/env python3
"""
TienDo — PDF page 1 → tiles (JPEG 1024×1024, DPI mặc định 150).
Stdout: một dòng JSON cuối cùng {success, width_px, height_px, tiles_generated} hoặc {success, error}.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser(description="PDF to JPEG tiles")
    parser.add_argument("--input", required=True, help="Path to PDF file")
    parser.add_argument("--output-dir", required=True, help="Directory for tile JPEGs")
    parser.add_argument("--tile-size", type=int, default=1024)
    parser.add_argument("--dpi", type=int, default=150)
    args = parser.parse_args()

    try:
        from pdf2image import convert_from_path
        from PIL import Image
    except ImportError as exc:
        print(json.dumps({"success": False, "error": f"Import error: {exc}"}))
        return 1

    pdf_path = Path(args.input)
    out_dir = Path(args.output_dir)
    tile_size = int(args.tile_size)
    dpi = int(args.dpi)

    if not pdf_path.is_file():
        print(json.dumps({"success": False, "error": "Input PDF not found."}))
        return 1

    out_dir.mkdir(parents=True, exist_ok=True)

    try:
        images = convert_from_path(
            str(pdf_path),
            dpi=dpi,
            first_page=1,
            last_page=1,
        )
    except Exception as exc:  # noqa: BLE001
        print(json.dumps({"success": False, "error": str(exc)}))
        return 1

    if not images:
        print(json.dumps({"success": False, "error": "No pages rendered from PDF."}))
        return 1

    img = images[0].convert("RGB")
    width_px, height_px = img.size
    tiles_generated = 0

    yi = 0
    for y in range(0, height_px, tile_size):
        xi = 0
        for x in range(0, width_px, tile_size):
            box = (x, y, min(x + tile_size, width_px), min(y + tile_size, height_px))
            crop = img.crop(box)
            canvas = Image.new("RGB", (tile_size, tile_size), (255, 255, 255))
            canvas.paste(crop, (0, 0))
            out_path = out_dir / f"0_{xi}_{yi}.jpg"
            canvas.save(out_path, "JPEG", quality=85, optimize=True)
            tiles_generated += 1
            xi += 1
        yi += 1

    print(
        json.dumps(
            {
                "success": True,
                "width_px": width_px,
                "height_px": height_px,
                "tiles_generated": tiles_generated,
            }
        )
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
