import { loadEnvFiles } from './load-env';

await loadEnvFiles();

const [{ env }, { buildTelegramBotReply }] = await Promise.all([import('../lib/env'), import('../lib/telegram/bot')]);

if (!env.TELEGRAM_BOT_TOKEN) {
  throw new Error('TELEGRAM_BOT_TOKEN is required in .env or .env.local.');
}

type GetUpdatesResponse = {
  ok: boolean;
  result: Array<{
    update_id: number;
    message?: {
      message_id: number;
      text?: string;
      chat: { id: number; type: string };
      from?: { id: number; username?: string };
    };
  }>;
};

async function callTelegram<T>(method: string, body?: Record<string, unknown>) {
  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: body ? 'POST' : 'GET',
    headers: body
      ? {
          'Content-Type': 'application/json'
        }
      : undefined,
    body: body ? JSON.stringify(body) : undefined
  });

  if (!response.ok) {
    throw new Error(`Telegram Bot API request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

let offset = 0;

console.log('FrontRunMe Telegram bot is polling for updates...');

while (true) {
  try {
    const response = await callTelegram<GetUpdatesResponse>('getUpdates', {
      offset,
      timeout: 30,
      allowed_updates: ['message']
    });

    for (const update of response.result) {
      offset = update.update_id + 1;
      const reply = await buildTelegramBotReply(update);
      if (!reply) {
        continue;
      }

      await callTelegram('sendMessage', {
        chat_id: reply.chatId,
        text: reply.text
      });
    }
  } catch (error) {
    console.error(error);
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
}
