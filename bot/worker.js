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

const SITE = 'https://uydilevich-ctrl.github.io/moi-web-sait/';
const CHANNEL = 'https://t.me/marudi_studio';

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
    'Сообщения клиентов будут приходить сюда. Чтобы ответить клиенту, нажмите «Ответить» на его сообщении и напишите текст — бот перешлёт его от имени MARUDI.',
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
};

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

async function tg(env, method, body) {
  const res = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}
