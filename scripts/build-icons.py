"""Optional asset build: rasterize the unchanged Figma Logo A using PyMuPDF.
Committed PNGs make application checks and deployment independent of Python.
"""
from pathlib import Path
import fitz

root = Path(__file__).resolve().parent.parent
logo_svg = fitz.open(root / 'assets/icons/logo.svg')
logo = fitz.open(stream=logo_svg.convert_to_pdf(), filetype='pdf')
for name, size, inset in [('pwa-192.png', 192, 32), ('pwa-512.png', 512, 86), ('pwa-maskable-512.png', 512, 128)]:
    document = fitz.open()
    page = document.new_page(width=size, height=size)
    page.draw_rect(page.rect, color=None, fill=(245/255, 244/255, 240/255))
    page.show_pdf_page(fitz.Rect(inset, inset, size-inset, size-inset), logo, 0)
    page.get_pixmap(alpha=False).save(root / 'assets/icons' / name)
print('Rendered PWA icons from the unchanged local Figma Logo A.')
