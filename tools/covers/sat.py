"""Обложки субботних постов «Закулисье» (октябрь 2026): 14 — знак, 15 — варианты, 17 — месяц.
Запуск из tools/covers: python3 sat.py  → assets/posts/post-1X-*.jpg"""
import os, re
from playwright.sync_api import sync_playwright
from PIL import Image
CSS = re.search(r'<style>(.*?)</style>', open('post-5-process.html').read(), re.S).group(1)
R = '/home/user/moi-web-sait/'
L = R + 'assets/logo/'; V = R + 'tools/covers/sat/'; P = R + 'assets/posts/'
page = lambda body: '<!doctype html><html><head><meta charset="utf-8"><style>' + CSS + '''
.pair{position:absolute;left:80px;right:80px;top:200px;height:560px;display:grid;grid-template-columns:1fr 1fr;gap:24px}
.pair div{background:#f8f0e5 center/contain no-repeat;border:1px solid rgba(27,27,26,.08)}
.cap{position:absolute;top:780px;left:80px;right:80px;display:grid;grid-template-columns:1fr 1fr;gap:24px;font-size:18px;letter-spacing:.24em;text-transform:uppercase;color:#6d665b;text-align:center}
.grid{position:absolute;left:80px;right:80px;top:190px;display:grid;grid-template-columns:1fr 1fr;gap:20px}
.grid figure{margin:0}.grid img{width:100%;aspect-ratio:7/4;object-fit:cover;display:block}
.grid figcaption{font-size:16px;letter-spacing:.22em;text-transform:uppercase;color:#6d665b;margin-top:10px}
.grid .ok figcaption{color:#1b1b1a;font-weight:500}.grid .ok img{outline:2px solid #c9b48a;outline-offset:4px}
</style></head><body>''' + body + '</body></html>'
top = f'<div class="top"><img src="{L}mark-graphite.svg"><b>MARUDI</b></div>'
foot = lambda n: f'<div class="foot"><span>creative digital studio</span><span>{n}</span></div>'
C = {
'post-14-znak': page(top + f'''<div class="pair"><div style="background-image:url({R}tools/logo/logo-original-calligraphic.jpg)"></div><div style="background-image:url({L}mark-graphite.svg);background-size:62%"></div></div>
<div class="cap"><span>с чего началось</span><span>знак сегодня</span></div>
<div class="band" style="top:860px"><div class="rub">Закулисье</div><h1>Как появился <em>знак MARUDI</em></h1></div>''' + foot('14')),
'post-15-varianty': page(top + f'''<div class="grid">
<figure><img src="{V}variant-1.jpg"><figcaption>вариант 1 · тёмный фон</figcaption></figure>
<figure><img src="{V}variant-2.jpg"><figcaption>вариант 2 · ветки за вазой</figcaption></figure>
<figure><img src="{V}variant-3.jpg"><figcaption>вариант 3 · две вазы</figcaption></figure>
<figure class="ok"><img src="{V}variant-final.jpg"><figcaption>выбран</figcaption></figure></div>
<div class="band" style="top:930px;padding-top:48px"><div class="rub">Закулисье</div><h1 style="font-size:88px">Нейросеть рисует — <em>я выбираю</em></h1></div>''' + foot('15')),
'post-17-mesyac': page(top + '''<div class="text" style="top:300px"><div class="rub">Закулисье · октябрь</div><h1 style="font-size:128px">Первый месяц <em>MARUDI</em></h1><div class="rule"></div>
<div class="steps"><div><span>01</span><p><b>Сайт</b>Работы, услуги и условия в одном месте</p></div><div><span>02</span><p><b>Канал</b>Работы, процесс и идеи три раза в неделю</p></div><div><span>03</span><p><b>Бот для заявок</b>Пишите в любое время</p></div></div></div>''' + foot('17')),
}
px = os.environ.get('HTTPS_PROXY')
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome', proxy={'server': px} if px else None,
                          args=['--ignore-certificate-errors', '--allow-file-access-from-files'])
    for n, h in C.items():
        open(n + '.html', 'w').write(h)
        pg = b.new_page(viewport={'width': 1080, 'height': 1350}); pg.goto('file://' + os.path.abspath(n + '.html')); pg.wait_for_timeout(2000)
        pg.screenshot(path='tmp.png'); pg.close()
        Image.open('tmp.png').convert('RGB').save(P + n + '.jpg', quality=88, optimize=True, progressive=True)
    b.close()
os.remove('tmp.png')
