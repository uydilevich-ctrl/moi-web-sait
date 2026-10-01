import imageio, numpy as np, subprocess
from PIL import Image, ImageDraw
import imageio_ffmpeg
FF=imageio_ffmpeg.get_ffmpeg_exe()
src='source-hero.mp4'
r=imageio.get_reader(src)
mock=Image.open('mock.png').convert('RGB')
def window(w,h):
    tb=max(3,round(h*0.045))
    win=Image.new('RGB',(w,h),(246,243,238))
    body=mock.resize((w,h-tb),Image.LANCZOS); win.paste(body,(0,tb))
    d=ImageDraw.Draw(win);cy=tb//2;rad=max(1,tb//5)
    for k,c in enumerate([(236,106,94),(244,190,80),(98,197,84)]):
        cx=tb*0.7+k*tb*0.55; d.ellipse([cx-rad,cy-rad,cx+rad,cy+rad],fill=c)
    return win
def rect(f,i):
    if 168<=i<=200: return (198,86,1082,634)
    m=(f.min(axis=2)>240)
    cs=m.sum(0);rs=m.sum(1)
    if cs.max()<8: return None
    xs=np.where(cs>0.25*cs.max())[0];ys=np.where(rs>0.25*rs.max())[0]
    hb=ys[-1]-ys[0]; tb=int(hb*0.05)+2
    return (xs[0]-2,ys[0]-tb,xs[-1]+3+int((xs[-1]-xs[0])*0.014),ys[-1]+3)
def alpha(i):
    return 0 if i<158 else min(1,(i-158)/5)
out=subprocess.Popen([FF,'-y','-f','rawvideo','-pix_fmt','rgb24','-s','1280x720','-r','24','-i','-','-c:v','libx264','-crf','10','-pix_fmt','yuv420p','tmp_lossless.mp4'],stdin=subprocess.PIPE,stderr=subprocess.DEVNULL)
# Crossfade (frames ~150-167): the source fades the editorial shot into the
# old website. Measure how much of the old site is in each frame (t), take
# it out and put the same share of the gallery window in.
E=r.get_data(146).astype(float); M=r.get_data(170).astype(float); D=M-E; dd=(D*D).sum()
O168=r.get_data(168).astype(float)
x0,y0,x1,y1=198,86,1082,634
C168=O168.copy(); C168[y0:y1,x0:x1]=np.array(window(x1-x0,y1-y0)).astype(float)
DELTA=C168-O168
# the same window, empty: title bar and the ivory page only
blank=Image.new('RGB',(x1-x0,y1-y0),(246,243,238)); bw=np.array(window(x1-x0,y1-y0))
tb=max(3,round((y1-y0)*0.045))+ int((y1-y0-max(3,round((y1-y0)*0.045)))*0.095)
B=np.array(blank).astype(float); B[:tb]=bw[:tb]   # keep title bar + MARUDI header strip
CB=C168.copy(); CB[y0:y1,x0:x1]=B
for i in range(240):
    f=r.get_data(i)
    # Slow, two-step transition (frames 140-182, ~1.75 s):
    # editorial shot -> empty browser window -> gallery. No double images.
    if i<=152: Elast=f.astype(float)
    if 140<=i<=182:
        p=(i-140)/42
        u=p*p*(3-2*p)
        g=(1-u)*Elast+u*C168      # editorial shot flows straight into the gallery
        f=np.clip(g,0,255).astype(np.uint8)
        out.stdin.write(f.tobytes()); continue
    a=1 if i>=168 else 0
    if a>0 and i<=230:
        rc=rect(f,i) if i>=168 else (198,86,1082,634)
        if rc and rc[2]-rc[0]>20:
            x0,y0,x1,y1=rc;w,h=x1-x0,y1-y0
            win=np.array(window(w,h)).astype(float)
            reg=f[y0:y1,x0:x1].astype(float)
            f=f.copy();f[y0:y1,x0:x1]=(reg*(1-a)+win*a).astype(np.uint8)
    out.stdin.write(f.tobytes())
out.stdin.close();out.wait()
