"""Вставляет в шоурил вертикальный ролик «Дождь в Париже» (source-paris-poster.mp4, 720×1280)
перед анимацией сайта (чёрный кадр 925 в sr_video.mp4 от showreel.py).
Вертикальное видео — по центру, по бокам его же размытая копия; вход и выход через чёрный, как у других роликов.
Запуск после showreel.py: python3 showreel_paris.py → sr_final.mp4 (без звука, звук в шоуриле тихий)."""
import imageio, numpy as np, subprocess, imageio_ffmpeg
from PIL import Image, ImageFilter
FF = imageio_ffmpeg.get_ffmpeg_exe()
CUT, FIN, FOUT = 925, 10, 8
clip = [f for f in imageio.get_reader('source-paris-poster.mp4')]
def frame(f):
    im = Image.fromarray(f)
    bg = im.resize((1280, int(1280 * im.height / im.width)), Image.LANCZOS)
    y = (bg.height - 720) // 2
    bg = bg.crop((0, y, 1280, y + 720)).filter(ImageFilter.GaussianBlur(28))
    bg = Image.fromarray((np.asarray(bg).astype(float) * 0.72).astype(np.uint8))
    fg = im.resize((int(720 * im.width / im.height), 720), Image.LANCZOS)
    bg.paste(fg, ((1280 - fg.width) // 2, 0))
    return np.asarray(bg)
p = subprocess.Popen([FF, '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '1280x720', '-r', '24', '-i', '-',
                      '-c:v', 'libx264', '-crf', '12', '-pix_fmt', 'yuv420p', 'sr_final.mp4'],
                     stdin=subprocess.PIPE, stderr=subprocess.DEVNULL)
for t, f in enumerate(imageio.get_reader('sr_video.mp4')):
    p.stdin.write(f.tobytes())
    if t == CUT:  # чёрный кадр: дальше наш ролик, потом снова чёрный кадр
        n = len(clip)
        for i, c in enumerate(clip):
            a = min(1, (i + 1) / (FIN + 1), (n - i) / (FOUT + 1))
            p.stdin.write((frame(c).astype(float) * a).astype(np.uint8).tobytes())
        p.stdin.write(np.zeros((720, 1280, 3), np.uint8).tobytes())
p.stdin.close(); p.wait()
