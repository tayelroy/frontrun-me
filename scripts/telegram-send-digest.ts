import { loadEnvFiles } from './load-env';

await loadEnvFiles();

const [{ env }, { collectPendingDigestItems, sendDigestWithTracking }] = await Promise.all([
  import('../lib/env'),
  import('../lib/telegram/digest')
]);

if (!env.TELEGRAM_BOT_TOKEN) {
  throw new Error('TELEGRAM_BOT_TOKEN is required in .env or .env.local.');
}

if (!env.TELEGRAM_DIGEST_CHAT_ID) {
  throw new Error('TELEGRAM_DIGEST_CHAT_ID is required in .env or .env.local.');
}

async function sendTelegramMessage(chatId: string, text: string) {
  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true
    })
  });

  if (!response.ok) {
    throw new Error(`Telegram Bot API request failed: ${response.status}`);
  }
}

const items = await collectPendingDigestItems(12);

if (items.length === 0) {
  console.log('No new Telegram clusters are ready for digest delivery.');
  process.exit(0);
}

const result = await sendDigestWithTracking({
  destination: env.TELEGRAM_DIGEST_CHAT_ID,
  items,
  deliver: async (message) => sendTelegramMessage(env.TELEGRAM_DIGEST_CHAT_ID!, message)
});

console.log(`Sent digest ${result.digestRunId} with ${items.length} clusters to ${env.TELEGRAM_DIGEST_CHAT_ID}`);
