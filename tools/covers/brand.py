"""Ставит знак MARUDI на готовую картинку (например, из YandexART) и сохраняет JPG.

python3 tools/covers/brand.py <картинка> <результат.jpg> [--corner br|bl|tr|tl]
Знак — исходный логотип Марии (assets/logo/mark-graphite.svg) + слово MARUDI, в углу,
где на кадре свободное светлое место. Рендер через Playwright + Chromium.
"""
import argparse, os, pathlib
from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[2]
LOGO = ROOT / 'assets/logo/mark-graphite.svg'
POS = {'br': 'right:3.2%;bottom:5%', 'bl': 'left:3.2%;bottom:5%', 'tr': 'right:3.2%;top:5%', 'tl': 'left:3.2%;top:5%'}

ap = argparse.ArgumentParser()
ap.add_argument('src'); ap.add_argument('dst'); ap.add_argument('--corner', default='br', choices=POS)
a = ap.parse_args()
w, h = Image.open(a.src).size
html = f'''<!doctype html><html><head><meta charset="utf-8"><style>
@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@500&display=swap');
body{{margin:0;width:{w}px;height:{h}px;background:url(file://{os.path.abspath(a.src)}) center/cover}}
.m{{position:absolute;{POS[a.corner]};display:flex;align-items:center;gap:{h*0.014:.0f}px;
  padding:{h*0.012:.0f}px {h*0.022:.0f}px;border-radius:999px;background:rgba(248,242,231,.78)}}
.m img{{height:{h*0.045:.0f}px}}
.m b{{font:500 {h*0.02:.0f}px Montserrat,sans-serif;letter-spacing:.32em;color:#1b1b1a;margin-right:-.32em}}
</style></head><body><div class="m"><img src="file://{LOGO}"><b>MARUDI</b></div></body></html>'''
tmp = pathlib.Path(a.dst).with_suffix('.tmp.html'); tmp.write_text(html)
px = os.environ.get('HTTPS_PROXY')
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
                          proxy={'server': px} if px else None,
                          args=['--ignore-certificate-errors', '--allow-file-access-from-files'])
    pg = b.new_page(viewport={'width': w, 'height': h}); pg.goto(f'file://{tmp.resolve()}'); pg.wait_for_timeout(1500)
    png = tmp.with_suffix('.png'); pg.screenshot(path=str(png)); b.close()
Image.open(png).convert('RGB').save(a.dst, quality=90, optimize=True, progressive=True)
tmp.unlink(); png.unlink()
print(a.dst)
