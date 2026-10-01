// Telegram-бот студии MARUDI (@marudi_studio_bot) для Cloudflare Workers.
//
// Что делает:
//  - на /start здоровается и показывает меню;
//  - пересылает Марии всё, что пишут клиенты;
//  - ответ Марии (через «Ответить» на пересланное сообщение) отправляет клиенту.
//
// Переменные окружения (Cloudflare → Worker → Settings → Variables and Secrets):
//  BOT_TOKEN       — токен от @BotFather (тип Secret)
//  WEBHOOK_SECRET  — любая длинная строка из букв и цифр (тип Secret)
//  ADMIN_ID        — числовой id Марии в Telegram (бот подскажет его по команде /myid)
//
// Публикации в канал по расписанию:
//  - очередь постов лежит на сайте в bot/posts.json;
//  - Cron Trigger «*/15 * * * *» раз в 15 минут публикует посты, время которых
//    наступило за прошедшие 15 минут; бот должен быть администратором канала.
//
// Обложки через YandexART (необязательно): если у поста есть поле "art" (описание
// картинки) и заданы YANDEX_API_KEY (Secret) и YANDEX_FOLDER_ID (Text), бот при публикации
// рисует новую обложку и ставит её первой вместо готовой. Если не получилось —
// публикует с готовой обложкой и сообщает Марии.

const SITE = 'https://uydilevich-ctrl.github.io/moi-web-sait/';
const CHANNEL = 'https://t.me/marudi_studio';
const CHANNEL_ID = '@marudi_studio';
const CRON_STEP_MS = 15 * 60 * 1000;

// Общий стиль MARUDI, добавляется к каждому описанию обложки.
// На обложке — только подпись бренда «MARUDI» (защита от копирования), без заголовков.
const ART_STYLE =
  'Премиальная editorial-фотография, минимализм, мягкий свет, тёплая палитра: слоновая кость, кремовый, бежевый, шампань. Внизу по центру небольшая элегантная надпись «MARUDI» тонким шрифтом с засечками, графитового цвета. Других надписей нет. Без людей и неона.';
const YA = 'https://llm.api.cloud.yandex.net';

const TEXT = {
  start:
    'Здравствуйте! Это MARUDI — творческая студия Марии ✨\n\n' +
    'Я создаю с помощью AI карточки для маркетплейсов, визуалы и видео для брендов, цифровые открытки и сайты.\n\n' +
    'Напишите, что вам нужно, прямо сюда — можно приложить примеры, которые нравятся. Мария ответит лично в течение дня.',
  services:
    'Чем могу помочь:\n\n' +
    '— Карточки для маркетплейсов: серия слайдов для Wildberries и Ozon\n' +
    '— AI-фотографии и визуалы для рекламы, каталогов и соцсетей\n' +
    '— AI-видео и анимация: короткие ролики для рилс и рекламы\n' +
    '— Контент для соцсетей в едином стиле\n' +
    '— Тексты и сценарии\n' +
    '— Сайты и лендинги\n' +
    '— Цифровые открытки, в том числе корпоративные\n\n' +
    'Напишите, что из этого вам интересно, и в двух словах о задаче.',
  order:
    'С удовольствием! Расскажите одним сообщением:\n\n' +
    '1. Что нужно сделать\n' +
    '2. Для чего: товар, бренд, праздник…\n' +
    '3. Желаемые сроки\n\n' +
    'Если есть примеры или фото товара — прикрепите их. Мария ответит лично.',
  received: 'Спасибо, сообщение получено! Мария ответит в ближайшее время 🤍',
  adminHelp:
    'Вы администратор бота MARUDI.\n\n' +
    'Сообщения клиентов будут приходить сюда. Чтобы ответить клиенту, нажмите «Ответить» на его сообщении и напишите текст — бот перешлёт его от имени MARUDI.\n\n' +
    'Команда /queue покажет посты, запланированные в канал.',
  replyHint: 'Чтобы ответить клиенту, нажмите «Ответить» на его сообщении.',
  replyFailed: 'Не получилось отправить ответ: клиент мог заблокировать бота.',
  replySent: '✓ Отправлено',
};

const MENU = {
  inline_keyboard: [
    [{ text: 'Услуги', callback_data: 'services' }, { text: 'Оставить заявку', callback_data: 'order' }],
    [{ text: 'Посмотреть работы', url: SITE + '#work' }],
    [{ text: 'Telegram-канал', url: CHANNEL }],
  ],
};

// Метка, по которой бот понимает, кому отвечать: «#id123456789».
const TAG = /#id(\d+)/;

// Сообщения, к которым Telegram не позволяет добавить подпись.
const NO_CAPTION = ['sticker', 'video_note', 'dice', 'poll', 'location', 'venue', 'contact'];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Однократная настройка: открыть в браузере /setup?secret=WEBHOOK_SECRET
    if (request.method === 'GET' && url.pathname === '/setup') {
      if (!env.WEBHOOK_SECRET || url.searchParams.get('secret') !== env.WEBHOOK_SECRET) {
        return new Response('Неверный secret', { status: 403 });
      }
      const res = await tg(env, 'setWebhook', {
        url: `${url.origin}/webhook`,
        secret_token: env.WEBHOOK_SECRET,
        allowed_updates: ['message', 'callback_query'],
        drop_pending_updates: true,
      });
      await tg(env, 'setMyCommands', { commands: [{ command: 'start', description: 'Меню студии MARUDI' }] });
      return new Response(res.ok ? 'Готово! Бот подключён.' : `Ошибка: ${res.description}`, {
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      });
    }

    if (request.method === 'POST' && url.pathname === '/webhook') {
      if (request.headers.get('X-Telegram-Bot-Api-Secret-Token') !== env.WEBHOOK_SECRET) {
        return new Response('forbidden', { status: 403 });
      }
      const update = await request.json();
      try {
        await handle(update, env);
      } catch (e) {
        console.error(e);
      }
      // Всегда отвечаем 200, иначе Telegram будет повторять то же сообщение.
      return new Response('ok');
    }

    return new Response('MARUDI bot');
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(publishDue(env, event.scheduledTime));
  },
};

async function loadPosts() {
  const res = await fetch(`${SITE}bot/posts.json?t=${Date.now()}`, { cf: { cacheTtl: 0 } });
  if (!res.ok) throw new Error(`posts.json: HTTP ${res.status}`);
  return res.json();
}

// Публикует посты, время которых попало в окно (now − 15 мин; now].
export async function publishDue(env, now) {
  const posts = await loadPosts();
  const due = posts.filter((p) => {
    const at = Date.parse(p.at);
    return at > now - CRON_STEP_MS && at <= now;
  });
  for (const post of due) {
    const res = await publishPost(env, post);
    if (env.ADMIN_ID) {
      const text = res.ok
        ? `📣 Опубликовано в канале: «${post.title || post.id}»${res.artNote || ''}`
        : `Не получилось опубликовать «${post.title || post.id}»: ${res.description}`;
      await tg(env, 'sendMessage', { chat_id: env.ADMIN_ID, text });
    }
  }
}

export async function publishPost(env, post) {
  const chat = env.CHANNEL_ID || CHANNEL_ID;
  const media = (post.media || []).map((m) => ({ type: m.type, media: new URL(m.src, SITE).href }));
  const fits = (post.text || '').length <= 1024;
  const files = {};
  let artNote = '';

  if (post.art && env.YANDEX_API_KEY && env.YANDEX_FOLDER_ID) {
    try {
      files.art = await yandexArt(env, `${post.art}. ${ART_STYLE}`);
      const cover = { type: 'photo', media: 'attach://art' };
      // Новая обложка встаёт на место готовой (первое фото) или добавляется первой.
      if (media.length && media[0].type === 'photo') media[0] = cover;
      else media.unshift(cover);
      artNote = ' (обложка YandexART)';
    } catch (e) {
      artNote = ` (YandexART не сработал: ${e.message}; вышла готовая обложка)`;
    }
  }

  let res;
  if (media.length === 0) {
    res = await tg(env, 'sendMessage', { chat_id: chat, text: post.text });
  } else if (media.length === 1) {
    const [m] = media;
    const method = m.type === 'video' ? 'sendVideo' : 'sendPhoto';
    res = await tg(env, method, { chat_id: chat, [m.type]: m.media, ...(fits ? { caption: post.text } : {}) }, files);
  } else {
    if (fits) media[0].caption = post.text;
    res = await tg(env, 'sendMediaGroup', { chat_id: chat, media }, files);
  }
  if (!res.ok && files.art) {
    // Telegram не принял новую обложку — публикуем с готовой.
    const retry = await publishPost(env, { ...post, art: undefined });
    retry.artNote = ` (обложку YandexART Telegram не принял: ${res.description}; вышла готовая обложка)`;
    return retry;
  }
  res.artNote = artNote;
  if (!res.ok) return res;
  if (!fits) {
    const t = await tg(env, 'sendMessage', { chat_id: chat, text: post.text });
    if (!t.ok) return t;
  }

  if (post.pin) {
    const first = Array.isArray(res.result) ? res.result[0] : res.result;
    await tg(env, 'pinChatMessage', { chat_id: chat, message_id: first.message_id, disable_notification: true });
  }
  return res;
}

// Рисует картинку 4:5 в YandexART и возвращает её как Blob (JPEG).
export async function yandexArt(env, prompt) {
  const headers = { Authorization: `Api-Key ${env.YANDEX_API_KEY}`, 'content-type': 'application/json' };
  const start = await fetch(`${YA}/foundationModels/v1/imageGenerationAsync`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      modelUri: `art://${env.YANDEX_FOLDER_ID}/yandex-art/latest`,
      generationOptions: { seed: String(Date.now() % 1e9), aspectRatio: { widthRatio: '4', heightRatio: '5' } },
      messages: [{ weight: '1', text: prompt.slice(0, 500) }],
    }),
  });
  const op = await start.json();
  if (!op.id) throw new Error(op.message || `HTTP ${start.status}`);

  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const st = await (await fetch(`${YA}/operations/${op.id}`, { headers })).json();
    if (st.error) throw new Error(st.error.message || 'ошибка генерации');
    if (st.done) {
      const bin = Uint8Array.from(atob(st.response.image), (c) => c.charCodeAt(0));
      return new Blob([bin], { type: 'image/jpeg' });
    }
  }
  throw new Error('не дождались картинку');
}

function fmtDate(iso) {
  return new Date(iso).toLocaleString('ru-RU', {
    timeZone: 'Europe/Moscow', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
  });
}

export async function handle(update, env) {
  const adminId = String(env.ADMIN_ID || '');

  if (update.callback_query) {
    const q = update.callback_query;
    await tg(env, 'answerCallbackQuery', { callback_query_id: q.id });
    const text = TEXT[q.data];
    if (text) await tg(env, 'sendMessage', { chat_id: q.message.chat.id, text });
    return;
  }

  const msg = update.message;
  if (!msg || msg.chat.type !== 'private') return;
  const chatId = String(msg.chat.id);
  const text = msg.text || '';

  if (text === '/myid') {
    await tg(env, 'sendMessage', { chat_id: chatId, text: `Ваш id: ${chatId}` });
    return;
  }

  if (adminId && chatId === adminId) {
    await fromAdmin(msg, env);
    return;
  }

  if (text.startsWith('/start')) {
    await tg(env, 'sendMessage', { chat_id: chatId, text: TEXT.start, reply_markup: MENU });
    return;
  }

  if (!adminId) return; // бот ещё не настроен до конца
  await toAdmin(msg, env, adminId);
  await tg(env, 'sendMessage', { chat_id: chatId, text: TEXT.received });
}

async function toAdmin(msg, env, adminId) {
  const u = msg.from || {};
  const name = [u.first_name, u.last_name].filter(Boolean).join(' ') || 'Клиент';
  const who = `✉️ ${name}${u.username ? ' (@' + u.username + ')' : ''}  #id${msg.chat.id}`;

  if (msg.text) {
    await tg(env, 'sendMessage', { chat_id: adminId, text: `${who}\n\n${msg.text}` });
    return;
  }

  const kind = NO_CAPTION.find((k) => msg[k]);
  if (kind) {
    // Без подписи: сначала заголовок с меткой, затем само сообщение.
    await tg(env, 'sendMessage', { chat_id: adminId, text: who });
    await tg(env, 'copyMessage', { chat_id: adminId, from_chat_id: msg.chat.id, message_id: msg.message_id });
    return;
  }

  const caption = `${who}${msg.caption ? '\n\n' + msg.caption : ''}`;
  await tg(env, 'copyMessage', {
    chat_id: adminId,
    from_chat_id: msg.chat.id,
    message_id: msg.message_id,
    caption: caption.slice(0, 1024),
  });
}

async function fromAdmin(msg, env) {
  if (msg.text === '/queue') {
    const now = Date.now();
    const next = (await loadPosts()).filter((p) => Date.parse(p.at) > now).sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
    const text = next.length
      ? 'Запланировано в канал:\n\n' + next.map((p) => `• ${fmtDate(p.at)} — ${p.title || p.id}`).join('\n')
      : 'Запланированных постов нет.';
    await tg(env, 'sendMessage', { chat_id: msg.chat.id, text });
    return;
  }
  const r = msg.reply_to_message;
  const m = r && TAG.exec(`${r.text || ''} ${r.caption || ''}`);
  if (!m) {
    const text = (msg.text || '').startsWith('/start') ? TEXT.adminHelp : TEXT.replyHint;
    await tg(env, 'sendMessage', { chat_id: msg.chat.id, text });
    return;
  }
  const res = await tg(env, 'copyMessage', { chat_id: m[1], from_chat_id: msg.chat.id, message_id: msg.message_id });
  await tg(env, 'sendMessage', {
    chat_id: msg.chat.id,
    text: res.ok ? TEXT.replySent : TEXT.replyFailed,
    reply_to_message_id: msg.message_id,
  });
}

// Вызов Telegram Bot API. Если переданы files — отправка multipart с загрузкой файлов.
async function tg(env, method, body, files = {}) {
  const url = `https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`;
  if (!Object.keys(files).length) {
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    return res.json();
  }
  const form = new FormData();
  for (const [k, v] of Object.entries(body)) form.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
  for (const [name, blob] of Object.entries(files)) {
    // Одиночное фото: поле photo=attach://art заменяем самим файлом.
    if (body.photo === `attach://${name}`) form.set('photo', blob, `${name}.jpg`);
    else form.append(name, blob, `${name}.jpg`);
  }
  const res = await fetch(url, { method: 'POST', body: form });
  return res.json();
}
