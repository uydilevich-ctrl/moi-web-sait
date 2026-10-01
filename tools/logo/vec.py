from PIL import Image, ImageDraw, ImageFilter
import numpy as np, potrace
src=Image.open('logo-original-calligraphic.jpg').convert('L')
X0,Y0,X1,Y1=140,420,400,600; K=8
crop=src.crop((X0,Y0,X1,Y1)).resize(((X1-X0)*K,(Y1-Y0)*K),Image.BICUBIC).filter(ImageFilter.GaussianBlur(K*0.6))
ink=np.array(crop)<128
L=np.array(src).astype(float)
# stick centre line, measured on the original
def center(y):
    lo=int(331-(y-484)*0.5)-6;hi=lo+12
    seg=np.clip(195-L[y,lo:hi],0,None);xs=np.arange(lo,hi);return (seg*xs).sum()/seg.sum()
ys=np.arange(486,532);cx=np.array([center(y) for y in ys])
f=np.poly1d(np.polyfit(ys,cx,2));g=np.poly1d(np.polyfit(ys[ys<505],cx[ys<505],1))
def xp(y):
    t=np.clip((512-y)/30,0,1);t=t*t*(3-2*t);return (1-t)*f(y)+t*g(y)
# erase the old tip
yy,xx=np.mgrid[0:ink.shape[0],0:ink.shape[1]]
oy=yy/K+Y0; ox=xx/K+X0
band=(oy>478)&(oy<533)&(np.abs(ox-xp(oy))<4.2)
ink[band]=False
# draw the new stroke
img=Image.fromarray(ink.astype(np.uint8)*255);d=ImageDraw.Draw(img)
W=5.0*K
wy=lambda y: np.interp(y,[458,500,520,528,536],[4.3,4.25,4.0,3.8,3.55])
for y in np.linspace(536,458,1600):
    x=(xp(y)-X0)*K; Y=(y-Y0)*K; r=wy(y)*K/2
    d.ellipse([x-r,Y-r,x+r,Y+r],fill=255)
ink=np.array(img.filter(ImageFilter.GaussianBlur(K*0.45)))>127
Image.fromarray((~ink).astype(np.uint8)*255).save('clean-bitmap.png')
bm=potrace.Bitmap(~ink)
pl=bm.trace(turdsize=40,alphamax=1.25,opticurve=True,opttolerance=0.8)
parts=[]
for c in pl:
    s=c.start_point;p=[f"M{s.x/K:.2f},{s.y/K:.2f}"]
    for seg in c.segments:
        if seg.is_corner: p.append(f"L{seg.c.x/K:.2f},{seg.c.y/K:.2f}L{seg.end_point.x/K:.2f},{seg.end_point.y/K:.2f}")
        else: p.append(f"C{seg.c1.x/K:.2f},{seg.c1.y/K:.2f} {seg.c2.x/K:.2f},{seg.c2.y/K:.2f} {seg.end_point.x/K:.2f},{seg.end_point.y/K:.2f}")
    parts.append(''.join(p)+'Z')
d=''.join(parts)
# tight viewBox
ys_,xs_=np.where(ink);vb=f"{xs_.min()/K-2:.1f} {ys_.min()/K-2:.1f} {(xs_.max()-xs_.min())/K+4:.1f} {(ys_.max()-ys_.min())/K+4:.1f}"
open('mark-trace-d.txt','w').write(d);open('mark-trace-vb.txt','w').write(vb)
for name,col in [('mark-graphite','#1b1b1a'),('mark-ivory','#f7f0e4')]:
    open(f'{name}.svg','w').write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}"><path fill="{col}" fill-rule="evenodd" d="{d}"/></svg>')
print(vb,len(d))
# bold variant for tiny sizes (favicon)
from PIL import ImageFilter as IF
boldimg=Image.fromarray(ink.astype(np.uint8)*255).filter(IF.MaxFilter(int(K*2.2)|1)).filter(IF.GaussianBlur(K*0.5))
bink=np.array(boldimg)>127
pl=potrace.Bitmap(~bink).trace(turdsize=40,alphamax=1.25,opticurve=True,opttolerance=0.8)
parts=[]
for c in pl:
    s=c.start_point;p=[f"M{s.x/K:.2f},{s.y/K:.2f}"]
    for seg in c.segments:
        if seg.is_corner: p.append(f"L{seg.c.x/K:.2f},{seg.c.y/K:.2f}L{seg.end_point.x/K:.2f},{seg.end_point.y/K:.2f}")
        else: p.append(f"C{seg.c1.x/K:.2f},{seg.c1.y/K:.2f} {seg.c2.x/K:.2f},{seg.c2.y/K:.2f} {seg.end_point.x/K:.2f},{seg.end_point.y/K:.2f}")
    parts.append(''.join(p)+'Z')
ys_,xs_=np.where(bink);vb2=f"{xs_.min()/K-2:.1f} {ys_.min()/K-2:.1f} {(xs_.max()-xs_.min())/K+4:.1f} {(ys_.max()-ys_.min())/K+4:.1f}"
open('mark-bold.svg','w').write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb2}"><path fill="#1b1b1a" fill-rule="evenodd" d="{"".join(parts)}"/></svg>')
