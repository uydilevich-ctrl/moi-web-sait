import assert from 'node:assert/strict';
import { publishPost, publishDue } from '../worker.js';
globalThis.setTimeout = (fn) => { fn(); return 0; };
const IMG = Buffer.from('fakejpeg').toString('base64');
let calls = [], polls = 0, mode = 'ok', tgFailUpload = false;
globalThis.fetch = async (url, opt = {}) => {
  url = String(url);
  if (url.includes('imageGenerationAsync')) {
    const b = JSON.parse(opt.body);
    calls.push(['ya-start', b, opt.headers]);
    if (mode === 'bad-key') return { status: 401, json: async () => ({ message: 'Unauthorized' }) };
    return { status: 200, json: async () => ({ id: 'op1' }) };
  }
  if (url.includes('/operations/op1')) {
    polls++;
    if (mode === 'gen-error') return { json: async () => ({ done: true, error: { message: 'blocked' } }) };
    return { json: async () => (polls < 3 ? { done: false } : { done: true, response: { image: IMG } }) };
  }
  if (url.includes('posts.json')) return { ok: true, json: async () => posts };
  const method = url.split('/').pop();
  const isForm = opt.body instanceof FormData;
  const body = isForm ? Object.fromEntries([...opt.body.entries()]) : JSON.parse(opt.body);
  calls.push([method, body, isForm]);
  if (tgFailUpload && isForm) return { json: async () => ({ ok: false, description: 'bad photo' }) };
  const result = method === 'sendMediaGroup' ? [{ message_id: 7 }] : { message_id: 7 };
  return { json: async () => ({ ok: true, result }) };
};
const env = { BOT_TOKEN: 'T', ADMIN_ID: '1', YANDEX_API_KEY: 'K', YANDEX_FOLDER_ID: 'F' };
const cover = { type: 'photo', src: 'assets/posts/x.jpg' };
const reset = (m = 'ok') => { calls = []; polls = 0; mode = m; tgFailUpload = false; };

// 1. single cover replaced by art, multipart upload, pin works
reset();
let r = await publishPost(env, { text: 'Привет', art: 'свеча на подоконнике', media: [cover], pin: true });
assert.ok(r.ok); assert.match(r.artNote, /YandexART/);
const ya = calls.find(c => c[0] === 'ya-start');
assert.equal(ya[1].modelUri, 'art://F/yandex-art/latest'); assert.equal(ya[2].Authorization, 'Api-Key K');
assert.match(ya[1].messages[0].text, /свеча на подоконнике.*«MARUDI».*Других надписей нет/);
assert.deepEqual(ya[1].generationOptions.aspectRatio, { widthRatio: '4', heightRatio: '5' });
const sp = calls.find(c => c[0] === 'sendPhoto');
assert.equal(sp[2], true); assert.ok(sp[1].photo instanceof Blob); assert.equal(sp[1].caption, 'Привет');
assert.ok(calls.some(c => c[0] === 'pinChatMessage'));

// 2. album: first photo replaced, others kept, media JSON references attach://art
reset();
r = await publishPost(env, { text: 'A', art: 'p', media: [cover, { type: 'photo', src: 'b.jpg' }] });
const g = calls.find(c => c[0] === 'sendMediaGroup');
const m = JSON.parse(g[1].media);
assert.equal(m[0].media, 'attach://art'); assert.equal(m[0].caption, 'A'); assert.match(m[1].media, /b\.jpg$/);
assert.ok(g[1].art instanceof Blob);

// 3. video-only post: art added in front -> album of photo + video
reset();
r = await publishPost(env, { text: 'V', art: 'p', media: [{ type: 'video', src: 'v.mp4' }] });
const g3 = JSON.parse(calls.find(c => c[0] === 'sendMediaGroup')[1].media);
assert.deepEqual(g3.map(x => x.type), ['photo', 'video']);

// 4. no keys -> no Yandex call, regular cover by URL
reset();
r = await publishPost({ BOT_TOKEN: 'T' }, { text: 'x', art: 'p', media: [cover] });
assert.ok(!calls.some(c => c[0] === 'ya-start')); assert.equal(calls[0][2], false); assert.match(calls[0][1].photo, /x\.jpg$/);

// 5. Yandex errors -> fallback to ready cover, note explains
for (const md of ['bad-key', 'gen-error']) {
  reset(md);
  r = await publishPost(env, { text: 'x', art: 'p', media: [cover] });
  assert.ok(r.ok); assert.match(r.artNote, /не сработал/);
  const s = calls.find(c => c[0] === 'sendPhoto'); assert.equal(s[2], false); assert.match(s[1].photo, /x\.jpg$/);
}

// 6. Telegram rejects uploaded art -> retry with ready cover
reset(); tgFailUpload = true;
r = await publishPost(env, { text: 'x', art: 'p', media: [cover] });
assert.ok(r.ok); assert.match(r.artNote, /не принял/);
assert.equal(calls.filter(c => c[0] === 'sendPhoto').length, 2);

// 7. admin notification includes the art note
const posts = [{ id: 'p', title: 'Тест', at: '2026-10-02T10:00:00+03:00', text: 'x', art: 'p', media: [cover] }];
reset();
await publishDue(env, Date.parse('2026-10-02T10:00:00+03:00'));
assert.match(calls.at(-1)[1].text, /Опубликовано.*обложка YandexART/);
console.log('ART TESTS PASSED');

// 8. /publish command and cron error notification
{
  const { handle } = await import('../worker.js');
  const worker = (await import('../worker.js')).default;
  reset();
  await handle({ message: { chat: { id: 1, type: 'private' }, text: '/publish p', message_id: 1 } }, { BOT_TOKEN: 'T', ADMIN_ID: '1' });
  assert.ok(calls.some(c => c[0] === 'sendPhoto')); assert.match(calls.at(-1)[1].text, /Опубликовано.*Тест/);
  reset();
  await handle({ message: { chat: { id: 1, type: 'private' }, text: '/publish', message_id: 1 } }, { BOT_TOKEN: 'T', ADMIN_ID: '1' });
  assert.match(calls.at(-1)[1].text, /\/publish <id>[\s\S]*p — Тест/); assert.ok(!calls.some(c => c[0] === 'sendPhoto'));
  // cron: posts.json unavailable -> admin gets a warning instead of silence
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, opt) => String(url).includes('posts.json') ? { ok: false, status: 404 } : realFetch(url, opt);
  reset(); let w;
  await worker.scheduled({ scheduledTime: Date.now() }, { BOT_TOKEN: 'T', ADMIN_ID: '1' }, { waitUntil: (p) => (w = p) }); await w;
  assert.match(calls.at(-1)[1].text, /⚠️ Ошибка публикации по расписанию: posts\.json: HTTP 404/);
  globalThis.fetch = realFetch;
  console.log('PUBLISH TESTS PASSED');
}
