"""Рисует варианты обложек в YandexART для постов из bot/posts.json (поле `art`).

Запуск из корня репозитория:  python3 tools/covers/yart.py 04-otkrytki 05-process [-n 3] [-o папка]
Ключ подставляет среда Claude (API credentials «YandexART» для ai.api.cloud.yandex.net),
в коде его нет. Стиль берётся из ART_STYLE в bot/worker.js — как у бота.
"""
import argparse, base64, json, pathlib, re, urllib.request

FOLDER = 'b1ged18fkug6vktfokph'
URL = 'https://ai.api.cloud.yandex.net/v1/images/generations'
ROOT = pathlib.Path(__file__).resolve().parents[2]


def style():
    src = (ROOT / 'bot/worker.js').read_text()
    return re.search(r"const ART_STYLE =\s*'([^']*)'", src).group(1)


def draw(prompt, size='1792x1024'):
    body = json.dumps({'model': f'art://{FOLDER}/yandex-art-2.0/latest', 'prompt': prompt[:500], 'size': size}).encode()
    req = urllib.request.Request(URL, body, {'OpenAI-Project': FOLDER, 'content-type': 'application/json'})
    with urllib.request.urlopen(req, timeout=180) as r:
        return base64.b64decode(json.load(r)['data'][0]['b64_json'])


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('ids', nargs='+', help='id постов или описание в кавычках')
    ap.add_argument('-n', type=int, default=3, help='сколько вариантов')
    ap.add_argument('-o', default='yart-out', help='куда сохранять')
    a = ap.parse_args()
    posts = {p['id']: p for p in json.loads((ROOT / 'bot/posts.json').read_text())}
    out = pathlib.Path(a.o); out.mkdir(parents=True, exist_ok=True)
    for pid in a.ids:
        desc = posts[pid]['art'] if pid in posts else pid
        prompt = f'{desc}. {style()}'
        assert len(prompt) <= 500, f'{pid}: промт {len(prompt)} > 500'
        name = pid if pid in posts else 'custom'
        for i in range(1, a.n + 1):
            f = out / f'{name}-{i}.jpg'
            f.write_bytes(draw(prompt))
            print(f)
