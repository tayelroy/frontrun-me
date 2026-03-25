import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { loadEnvFiles } from './load-env';

await loadEnvFiles();

const [{ TelegramClient }, { StringSession }, { env }] = await Promise.all([
  import('telegram'),
  import('telegram/sessions'),
  import('../lib/env')
]);

if (!env.TELEGRAM_API_ID || !env.TELEGRAM_API_HASH) {
  throw new Error('TELEGRAM_API_ID and TELEGRAM_API_HASH are required in .env or .env.local.');
}

const rl = createInterface({ input, output });

async function ask(question: string, fallback?: string) {
  const suffix = fallback ? ` [${fallback}]` : '';
  const value = await rl.question(`${question}${suffix}: `);
  return value.trim() || fallback || '';
}

const stringSession = new StringSession(env.TELEGRAM_SESSION?.trim() ?? '');
const client = new TelegramClient(stringSession, env.TELEGRAM_API_ID, env.TELEGRAM_API_HASH, {
  connectionRetries: 5
});

try {
  await client.start({
    phoneNumber: async () => ask('Telegram phone number', env.TELEGRAM_PHONE_NUMBER),
    password: async () => ask('Telegram 2FA password', env.TELEGRAM_2FA_PASSWORD),
    phoneCode: async () => ask('Telegram login code'),
    onError: (error) => {
      throw error;
    }
  });

  const savedSession = client.session.save();

  output.write('\nTelegram login complete.\n');
  output.write('Add this to your .env or .env.local:\n\n');
  output.write(`TELEGRAM_SESSION=${savedSession}\n\n`);
} finally {
  rl.close();
  await client.disconnect().catch(() => null);
}
