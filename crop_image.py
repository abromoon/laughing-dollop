#!/usr/bin/env python3
"""
Обрезает изображение в квадрат с якорем сверху и с якорем снизу
(две отдельные копии), без потери качества (для lossless-форматов
вроде PNG — .crop() работает на уровне пикселей, без перекодирования
содержимого).

Использование:
    python3 crop_image.py path/to/image.png [output_dir_or_prefix]

Если второй аргумент не задан, результаты сохраняются рядом с исходником
с суффиксами "_square_top" и "_square_bottom"
(например, image.png -> image_square_top.png, image_square_bottom.png).
"""
import sys
from pathlib import Path

from PIL import Image


def crop_square(im: Image.Image, anchor: str) -> tuple[Image.Image, tuple[int, int, int, int]]:
    w, h = im.size
    side = min(w, h)
    x = (w - side) // 2  # центр по горизонтали
    y = 0 if anchor == "top" else h - side  # якорь сверху или снизу

    box = (x, y, x + side, y + side)
    return im.crop(box), box


def crop_square_both(src: Path, dst_top: Path, dst_bottom: Path) -> None:
    im = Image.open(src)
    w, h = im.size
    print(f"Исходный размер: {w}x{h}")

    for anchor, dst in (("top", dst_top), ("bottom", dst_bottom)):
        cropped, box = crop_square(im, anchor)
        cropped.save(dst)
        print(f"[{anchor}] область обреза: {box} -> {cropped.size[0]}x{cropped.size[1]} -> {dst}")


def main() -> None:
    if len(sys.argv) < 2:
        print(f"Использование: {sys.argv[0]} <путь_к_изображению> [output_dir_or_prefix]", file=sys.stderr)
        sys.exit(1)

    src = Path(sys.argv[1]).expanduser().resolve()
    if not src.is_file():
        print(f"Файл не найден: {src}", file=sys.stderr)
        sys.exit(1)

    if len(sys.argv) >= 3:
        arg = Path(sys.argv[2]).expanduser().resolve()
        if arg.is_dir():
            dst_top = arg / f"{src.stem}_square_top{src.suffix}"
            dst_bottom = arg / f"{src.stem}_square_bottom{src.suffix}"
        else:
            dst_top = arg.with_name(f"{arg.stem}_top{arg.suffix}")
            dst_bottom = arg.with_name(f"{arg.stem}_bottom{arg.suffix}")
    else:
        dst_top = src.with_name(f"{src.stem}_square_top{src.suffix}")
        dst_bottom = src.with_name(f"{src.stem}_square_bottom{src.suffix}")

    crop_square_both(src, dst_top, dst_bottom)


if __name__ == "__main__":
    main()
