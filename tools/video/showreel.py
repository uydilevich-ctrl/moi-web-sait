import imageio, numpy as np, subprocess, imageio_ffmpeg
FF=imageio_ffmpeg.get_ffmpeg_exe()
SR='source-showreel.mp4'
old=imageio.get_reader('source-showreel-old-site-clip.mp4')
new=imageio.get_reader('tmp_lossless.mp4')
OFF=925
p=subprocess.Popen([FF,'-y','-f','rawvideo','-pix_fmt','rgb24','-s','1280x720','-r','24','-i','-','-c:v','libx264','-crf','12','-pix_fmt','yuv420p','sr_video.mp4'],stdin=subprocess.PIPE,stderr=subprocess.DEVNULL)
for t,f in enumerate(imageio.get_reader(SR)):
    i=t-OFF
    if 0<=i<240:
        o=old.get_data(i).astype(float); n=new.get_data(i).astype(float)
        a=np.clip(f.astype(float).mean()/max(o.mean(),1),0,1)   # fade factor from/to black
        f=np.clip(f.astype(float)+(n-o)*a,0,255).astype(np.uint8)
    p.stdin.write(f.tobytes())
p.stdin.close();p.wait()
