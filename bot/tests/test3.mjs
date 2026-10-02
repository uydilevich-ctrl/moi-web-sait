import assert from 'node:assert/strict';
import { publishPost, publishDue } from '../worker.js';
globalThis.setTimeout = (fn) => { fn(); return 0; };
const IMG = Buffer.from('fakejpeg').toString('base64');
let calls = [], polls = 0, mode = 'ok', tgFailUpload = false;
globalThis.fetch = async (url, opt = {}) => {
  url = String(url);
  if (url === 'https://ai.api.cloud.yandex.net/v1/images/generations') {
    const b = JSON.parse(opt.body);
    calls.push(['ya-start', b, opt.headers]);
    if (mode === 'bad-key') return { ok: false, status: 401, json: async () => ({ error: { message: 'Unauthorized' } }) };
    if (mode === 'no-wide' && b.size !== '1024x1024') return { ok: false, status: 400, json: async () => ({ error: { message: 'bad size' } }) };
    if (mode === 'gen-error') return { ok: false, status: 403, json: async () => ({ message: 'blocked' }) };
    return { ok: true, status: 200, json: async () => ({ data: [{ b64_json: IMG }] }) };
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
let verdicts = [];
const AI = { run: async (model, inp) => { calls.push(['ai', model, inp]); return { response: verdicts.length ? verdicts.shift() : '{"ok": true, "reason": "чисто"}' }; } };
const env = { BOT_TOKEN: 'T', ADMIN_ID: '1', YANDEX_API_KEY: 'K', YANDEX_FOLDER_ID: 'F', AI };
const cover = { type: 'photo', src: 'assets/posts/x.jpg' };
const reset = (m = 'ok') => { calls = []; polls = 0; mode = m; tgFailUpload = false; verdicts = []; };

// 1. single cover replaced by art, multipart upload, pin works
reset();
let r = await publishPost(env, { text: 'Привет', art: 'свеча на подоконнике', media: [cover], pin: true });
assert.ok(r.ok); assert.match(r.artNote, /YandexART/);
const ya = calls.find(c => c[0] === 'ya-start');
assert.equal(ya[1].model, 'art://F/yandex-art-2.0/latest'); assert.equal(ya[2].Authorization, 'Bearer K');
assert.equal(ya[2]['OpenAI-Project'], 'F'); assert.equal(ya[1].size, '1792x1024');
assert.match(ya[1].prompt, /свеча на подоконнике\. Редакционная фотография.*без надписей\.$/);
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

// 9. /art: preview to admin only, by post id or free text; base64 decoded correctly
{
  const { handle } = await import('../worker.js');
  const adm = { chat: { id: 1, type: 'private' }, message_id: 1 };
  reset();
  await handle({ message: { ...adm, text: '/art p' } }, env);
  const ya9 = calls.find(c => c[0] === 'ya-start');
  assert.match(ya9[1].prompt, /^p\. Редакционная/);
  const ph = calls.find(c => c[0] === 'sendPhoto');
  assert.equal(ph[1].chat_id, '1'); assert.ok(ph[1].photo instanceof Blob);
  assert.equal(Buffer.from(await ph[1].photo.arrayBuffer()).toString(), 'fakejpeg');
  assert.ok(!calls.some(c => c[1].chat_id === '@marudi_studio'));
  reset();
  await handle({ message: { ...adm, text: '/art закат над морем' } }, env);
  assert.match(calls.find(c => c[0] === 'ya-start')[1].prompt, /^закат над морем\./);
  reset();
  await handle({ message: { ...adm, text: '/art p' } }, { BOT_TOKEN: 'T', ADMIN_ID: '1' });
  assert.match(calls.at(-1)[1].text, /Ключи YandexART не заданы/);
  reset('gen-error');
  await handle({ message: { ...adm, text: '/art p' } }, env);
  assert.match(calls.at(-1)[1].text, /⚠️ YandexART: blocked/);
  console.log('ART PREVIEW TESTS PASSED');
}

// 10. keys are cleaned of spaces/newlines/quotes; error shows folder id and key length only
{
  reset();
  await publishPost({ ...env, YANDEX_API_KEY: ' "K"\n', YANDEX_FOLDER_ID: ' F \n' }, { text: 'x', art: 'p', media: [cover] });
  const y = calls.find(c => c[0] === 'ya-start');
  assert.equal(y[1].model, 'art://F/yandex-art-2.0/latest'); assert.equal(y[2].Authorization, 'Bearer K'); assert.equal(y[2]['OpenAI-Project'], 'F');
  reset('bad-key');
  const r10 = await publishPost({ ...env, YANDEX_API_KEY: 'SECRETKEY123' }, { text: 'x', art: 'p', media: [cover] });
  assert.match(r10.artNote, /Unauthorized \(каталог: F, длина ключа: 12\)/); assert.doesNotMatch(r10.artNote, /SECRETKEY/);
  console.log('KEY CLEANUP TESTS PASSED');
}

// 11. wide size rejected (400) -> retry with square, art still used
{
  reset('no-wide');
  const r11 = await publishPost(env, { text: 'x', art: 'p', media: [cover] });
  assert.deepEqual(calls.filter(c => c[0] === 'ya-start').map(c => c[1].size), ['1792x1024', '1024x1024']);
  assert.doesNotMatch(r11.artNote, /не сработал/); assert.equal(calls.find(c => c[0] === 'sendPhoto')[2], true);
  console.log('SIZE FALLBACK TESTS PASSED');
}

// 12. every art prompt + style fits YandexART's 500-char limit (otherwise the style is cut off)
{
  const fs = await import('node:fs');
  const src = fs.readFileSync(new URL('../worker.js', import.meta.url), 'utf8');
  const style = src.match(/const ART_STYLE =\s*'([^']*)'/)[1];
  const all = JSON.parse(fs.readFileSync(new URL('../posts.json', import.meta.url), 'utf8'));
  for (const p of all.filter(p => p.art)) assert.ok(`${p.art}. ${style}`.length <= 500, `${p.id}: промт длиннее 500`);
  console.log('PROMPT LENGTH TESTS PASSED');
}

// 13. check: image goes to Workers AI with the description; rejected twice -> third accepted
{
  reset(); verdicts = ['{"ok": false, "reason": "кривая рука"}', 'Ответ: {"ok": false, "reason": "буквы"}'];
  const r13 = await publishPost(env, { text: 'x', art: 'конверт', media: [cover] });
  assert.equal(calls.filter(c => c[0] === 'ya-start').length, 3);
  const ai = calls.find(c => c[0] === 'ai');
  assert.match(ai[1], /llama-4-scout/);
  assert.match(ai[2].messages[0].content[0].text, /конверт/);
  assert.equal(ai[2].messages[0].content[1].image_url.url, `data:image/jpeg;base64,${IMG}`);
  assert.match(r13.artNote, /проверена, попытка 3/); assert.equal(calls.find(c => c[0] === 'sendPhoto')[2], true);
  // all rejected -> ready cover, reasons in the note
  reset(); verdicts = ['{"ok":false,"reason":"а"}', '{"ok":false,"reason":"б"}', '{"ok":false,"reason":"в"}'];
  const r13b = await publishPost(env, { text: 'x', art: 'p', media: [cover] });
  assert.match(r13b.artNote, /не прошли проверку: а; б; в; вышла готовая обложка/);
  const s13 = calls.find(c => c[0] === 'sendPhoto'); assert.equal(s13[2], false); assert.match(s13[1].photo, /x\.jpg$/);
  // garbage answer counts as rejection
  reset(); verdicts = ['не знаю', 'не знаю', 'не знаю'];
  assert.match((await publishPost(env, { text: 'x', art: 'p', media: [cover] })).artNote, /непонятный ответ/);
  // no Workers AI -> unchecked art is never published, one try only
  reset();
  const r13c = await publishPost({ ...env, AI: undefined }, { text: 'x', art: 'p', media: [cover] });
  assert.equal(calls.filter(c => c[0] === 'ya-start').length, 1);
  assert.match(r13c.artNote, /проверка недоступна/); assert.equal(calls.find(c => c[0] === 'sendPhoto')[2], false);
  // /art preview shows the verdict
  const { handle } = await import('../worker.js');
  reset(); verdicts = ['{"ok": false, "reason": "печать в форме розы"}'];
  await handle({ message: { chat: { id: 1, type: 'private' }, message_id: 1, text: '/art p' } }, env);
  assert.match(calls.find(c => c[0] === 'sendPhoto')[1].caption, /^❌ Проверка: не публиковать — печать в форме розы/);
  console.log('ART CHECK TESTS PASSED');
}
