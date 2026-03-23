#!/usr/bin/env python3
"""
TienDo — Bản vẽ (PDF / DXF / DWG) → raster → tiles JPEG (mặc định 1024×1024, DPI 150).

- PDF: pdf2image (trang 1), giữ hành vi cũ.
- DXF/DWG: ezdxf + matplotlib (Agg) rasterize modelspace, sau đó cùng pipeline cắt tile.

Stdout: một dòng JSON cuối cùng {success, width_px, height_px, tiles_generated} hoặc {success, error}.
"""
from __future__ import annotations

import argparse
import json
import os
import platform
import sys
from pathlib import Path

ALLOWED_EXT = {".pdf", ".dxf", ".dwg"}

DWG_READ_FAILED_MSG = (
    "Không đọc được file DWG. ezdxf không đọc trực tiếp hầu hết DWG nhị phân — "
    "cần cài ODA File Converter (lệnh ODAFileConverter trong PATH, hoặc đặt TIENDO_ODA_FILE_CONVERTER "
    "trỏ tới file thực thi / AppImage). Hoặc xuất DXF/PDF từ AutoCAD rồi upload. "
    "Xem CLAUDE.md và scripts/requirements-drawing.txt."
)


def _apply_oda_file_converter_env() -> None:
    """Ánh xạ TIENDO_ODA_FILE_CONVERTER (hoặc ODA_FILE_CONVERTER) → cấu hình odafc của ezdxf."""
    import ezdxf
    from ezdxf._options import ODAFC_ADDON

    path = (
        os.environ.get("TIENDO_ODA_FILE_CONVERTER", "").strip()
        or os.environ.get("ODA_FILE_CONVERTER", "").strip()
    )
    if not path:
        return
    key = "WIN_EXEC_PATH" if platform.system() == "Windows" else "UNIX_EXEC_PATH"
    ezdxf.options.set(ODAFC_ADDON, key, path)


def _load_dwg_via_odafc(path_str: str):
    """
    Đọc DWG qua ODA File Converter (chuyển tạm sang DXF rồi nạp bằng ezdxf).
    Trả về Drawing hoặc None nếu ODA chưa cài / không tìm thấy.
    """
    import ezdxf  # noqa: F401 — đảm bảo options đã load

    _apply_oda_file_converter_env()

    from ezdxf.addons import odafc

    try:
        return odafc.readfile(path_str)
    except odafc.ODAFCNotInstalledError:
        return None
    except odafc.UnsupportedFileFormat as exc:
        raise RuntimeError(f"ODA không hỗ trợ định dạng/phiên bản file: {exc}") from exc
    except odafc.UnknownODAFCError as exc:
        raise RuntimeError(
            "ODA File Converter không chuyển được DWG (file hỏng, hoặc DWG quá mới so với ODA). "
            f"Chi tiết: {exc}. Thử Save As DXF hoặc PDF trong AutoCAD."
        ) from exc


def tiles_from_rgb_image(img, out_dir: Path, tile_size: int) -> tuple[int, int, int]:
    """Cắt ảnh RGB thành tile JPEG; trả (width_px, height_px, tiles_generated)."""
    from PIL import Image

    img = img.convert("RGB")
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

    return width_px, height_px, tiles_generated


def process_pdf(pdf_path: Path, out_dir: Path, tile_size: int, dpi: int) -> tuple[int, int, int]:
    from pdf2image import convert_from_path

    images = convert_from_path(
        str(pdf_path),
        dpi=dpi,
        first_page=1,
        last_page=1,
    )
    if not images:
        raise RuntimeError("No pages rendered from PDF.")

    img = images[0]
    return tiles_from_rgb_image(img, out_dir, tile_size)


def load_cad_document(path: Path):
    import ezdxf
    from ezdxf import recover

    path_str = str(path)
    suffix = path.suffix.lower()

    def load_builtin():
        try:
            return ezdxf.readfile(path_str)
        except Exception:
            doc, _ = recover.readfile(path_str)
            return doc

    if suffix == ".dwg":
        try:
            return load_builtin()
        except Exception as first:  # noqa: BLE001
            doc = _load_dwg_via_odafc(path_str)
            if doc is not None:
                return doc
            raise RuntimeError(DWG_READ_FAILED_MSG) from first

    try:
        return load_builtin()
    except Exception as first:  # noqa: BLE001
        raise RuntimeError(f"Không đọc được file DXF: {first}") from first


def process_cad(cad_path: Path, out_dir: Path, tile_size: int, dpi: int) -> tuple[int, int, int]:
    from io import BytesIO

    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from ezdxf.addons.drawing import Frontend, RenderContext
    from ezdxf.addons.drawing.matplotlib import MatplotlibBackend
    from PIL import Image

    doc = load_cad_document(cad_path)
    msp = doc.modelspace()

    fig = plt.figure()
    ax = fig.add_axes([0, 0, 1, 1])
    ctx = RenderContext(doc)
    backend = MatplotlibBackend(ax)
    Frontend(ctx, backend).draw_layout(msp, finalize=True)
    ax.set_axis_off()

    buf = BytesIO()
    fig.savefig(
        buf,
        format="png",
        dpi=dpi,
        bbox_inches="tight",
        pad_inches=0.05,
        facecolor="white",
    )
    plt.close(fig)
    buf.seek(0)
    raster = Image.open(buf).convert("RGB")

    return tiles_from_rgb_image(raster, out_dir, tile_size)


def main() -> int:
    parser = argparse.ArgumentParser(description="Drawing file (PDF/DXF/DWG) to JPEG tiles")
    parser.add_argument("--input", required=True, help="Path to PDF, DXF, or DWG")
    parser.add_argument("--output-dir", required=True, help="Directory for tile JPEGs")
    parser.add_argument("--tile-size", type=int, default=1024)
    parser.add_argument("--dpi", type=int, default=150)
    args = parser.parse_args()

    input_path = Path(args.input)
    out_dir = Path(args.output_dir)
    tile_size = int(args.tile_size)
    dpi = int(args.dpi)
    ext = input_path.suffix.lower()

    if ext not in ALLOWED_EXT:
        print(
            json.dumps(
                {
                    "success": False,
                    "error": f"Định dạng không hỗ trợ ({ext or 'không có đuôi'}). "
                    "Chấp nhận: PDF, DXF, DWG.",
                }
            )
        )
        return 1

    if not input_path.is_file():
        print(json.dumps({"success": False, "error": "Input file not found."}))
        return 1

    out_dir.mkdir(parents=True, exist_ok=True)

    try:
        if ext == ".pdf":
            try:
                from pdf2image import convert_from_path  # noqa: F401
            except ImportError as exc:
                print(json.dumps({"success": False, "error": f"Import error: {exc}"}))
                return 1
            width_px, height_px, tiles_generated = process_pdf(input_path, out_dir, tile_size, dpi)
        else:
            try:
                import ezdxf  # noqa: F401
                import matplotlib.pyplot  # noqa: F401
            except ImportError as exc:
                print(
                    json.dumps(
                        {
                            "success": False,
                            "error": f"Thiếu thư viện xử lý CAD (ezdxf/matplotlib): {exc}",
                        }
                    )
                )
                return 1
            width_px, height_px, tiles_generated = process_cad(input_path, out_dir, tile_size, dpi)
    except RuntimeError as exc:
        print(json.dumps({"success": False, "error": str(exc)}))
        return 1
    except Exception as exc:  # noqa: BLE001
        print(json.dumps({"success": False, "error": str(exc)}))
        return 1

    if width_px <= 0 or height_px <= 0 or tiles_generated <= 0:
        print(json.dumps({"success": False, "error": "Rasterized image is empty or invalid."}))
        return 1

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
