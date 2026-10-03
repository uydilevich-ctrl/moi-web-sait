"""Логотип MARUDI со словом и подписью: PNG с прозрачным фоном (графит и слоновая кость).
python3 tools/logo/kit.py → assets/logo/kit/"""
import os
from playwright.sync_api import sync_playwright
R = '/home/user/moi-web-sait/'; OUT = R + 'assets/logo/kit/'
def html(color, mark, layout):
    if layout == 'h':
        body = f'''<div style="display:flex;align-items:center;gap:56px;padding:60px 80px">
<img src="file://{R}assets/logo/{mark}" style="height:220px">
<div><div style="font:500 92px Montserrat;letter-spacing:.32em;margin-right:-.32em">MARUDI</div>
<div style="font:400 27px Montserrat;letter-spacing:.42em;margin-top:22px;opacity:.75">CREATIVE DIGITAL STUDIO</div></div></div>'''
    else:
        body = f'''<div style="display:flex;flex-direction:column;align-items:center;padding:70px 90px">
<img src="file://{R}assets/logo/{mark}" style="height:300px">
<div style="font:500 96px Montserrat;letter-spacing:.32em;margin:44px -.32em 0 0">MARUDI</div>
<div style="font:400 28px Montserrat;letter-spacing:.42em;margin:24px -.42em 0 0;opacity:.75">CREATIVE DIGITAL STUDIO</div></div>'''
    return f'''<!doctype html><html><head><meta charset="utf-8"><style>
@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500&display=swap');
html,body{{margin:0;background:transparent;color:{color}}}#b{{display:inline-block}}</style></head>
<body><div id="b">{body}</div></body></html>'''
px = os.environ.get('HTTPS_PROXY')
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome', proxy={'server': px} if px else None,
                          args=['--ignore-certificate-errors', '--allow-file-access-from-files'])
    for name, color, mark in [('graphite', '#1b1b1a', 'mark-graphite.svg'), ('ivory', '#f8f2e7', 'mark-ivory.svg')]:
        for layout, label in [('h', 'horizontal'), ('v', 'vertical')]:
            f = OUT + f'tmp-{name}-{layout}.html'; open(f, 'w').write(html(color, mark, layout))
            pg = b.new_page(viewport={'width': 2400, 'height': 1200}, device_scale_factor=1)
            pg.goto('file://' + f); pg.wait_for_timeout(1800)
            pg.locator('#b').screenshot(path=OUT + f'marudi-{label}-{name}.png', omit_background=True)
            pg.close(); os.remove(f)
    b.close()
