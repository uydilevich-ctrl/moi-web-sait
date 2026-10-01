import os,re
from playwright.sync_api import sync_playwright
src=open('post-5-process.html').read()
CSS=re.search(r'<style>(.*?)</style>',src,re.S).group(1)
W='/home/user/moi-web-sait/assets/work/'
P='/home/user/moi-web-sait/assets/posts/'
L='/home/user/moi-web-sait/assets/logo/'
def page(body): return '<!doctype html><html><head><meta charset="utf-8"><style>'+CSS+'</style></head><body>'+body+'</body></html>'
top='<div class="top"><img src="'+L+'mark-graphite.svg"><b>MARUDI</b></div>'
def foot(n,dark=False):
    st=' style="color:#b9ad97"' if dark else ''
    return '<div class="foot"'+st+'><span>creative digital studio</span><span>'+n+'</span></div>'
sh='box-shadow:0 18px 40px -22px rgba(27,27,26,.45)'
C={
'post-07-svecha':page(top+f'''<div class="row" style="top:200px;left:70px;right:70px;height:418px;gap:20px;background:none">
<div style="background-image:url({W}candle-1.jpg);{sh}"></div><div style="background-image:url({W}candle-2.jpg);{sh}"></div><div style="background-image:url({W}candle-4.jpg);{sh}"></div></div>
<div class="band" style="top:690px;padding-top:80px"><div class="rub">Разбор работы</div><h1 style="font-size:104px">Одна свеча — <em>четыре слайда</em></h1></div>'''+foot('07')),
'post-09-oshibki':page(top+'''<div class="text" style="top:240px"><div class="rub">Польза · маркетплейсы</div><h1 style="font-size:100px;margin:28px 0 20px">5 ошибок <em>в карточке товара</em></h1>
<div class="steps"><div><span>01</span><p><b>Мелкий товар</b>Его не видно в ленте с телефона</p></div><div><span>02</span><p><b>Много текста</b>Главный слайд читают за секунду</p></div><div><span>03</span><p><b>Разный стиль</b>Слайды как из разных магазинов</p></div><div><span>04</span><p><b>Нет размеров</b>Покупатель уходит с вопросом</p></div><div><span>05</span><p><b>Нет жизни</b>Товар не показан в деле</p></div></div></div>'''+foot('09')),
'post-11-korporativ':page(f'''<div class="row" style="grid-template-columns:1fr 1fr"><div style="background-image:url({W}cards-partners-gold.webp)"></div><div style="background-image:url({W}cards-newyear-gold.webp)"></div></div>
<div class="band dark"><div class="rub">Для бизнеса · к Новому году</div><h1>Открытки <em>от вашей компании</em></h1></div>'''+foot('11',True)),
'post-13-sait':page(f'''<div class="img" style="background-image:url({P}site-hero.jpg);background-position:50% 30%"></div>
<div class="band"><div class="rub">Мой проект</div><h1>Этот сайт <em>я сделала сама</em></h1></div>'''+foot('13')),
}
px=os.environ.get('HTTPS_PROXY')
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome',proxy={'server':px} if px else None,args=['--ignore-certificate-errors','--allow-file-access-from-files'])
    for n,h in C.items():
        open(n+'.html','w').write(h)
        pg=b.new_page(viewport={'width':1080,'height':1350});pg.goto('file://'+os.path.abspath(n+'.html'));pg.wait_for_timeout(1800)
        pg.screenshot(path=f'MARUDI-{n}.png');pg.close()
    b.close()
from PIL import Image
s=Image.new('RGB',(4*300+50,375+20),(255,255,255))
for i,n in enumerate(C):
    im=Image.open(f'MARUDI-{n}.png');im.convert('RGB').save(P+n+'.jpg',quality=88,optimize=True,progressive=True)
    s.paste(im.resize((300,375),Image.LANCZOS),(10+i*310,10))
s.save('october-covers.png')
