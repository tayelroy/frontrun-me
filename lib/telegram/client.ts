import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { env } from '../env';

export interface TelegramWorkerAuthConfig {
  apiId: number;
  apiHash: string;
  session: string;
}

export function getTelegramWorkerAuthConfig(): TelegramWorkerAuthConfig {
  if (!env.TELEGRAM_API_ID) {
    throw new Error('TELEGRAM_API_ID is required.');
  }

  if (!env.TELEGRAM_API_HASH) {
    throw new Error('TELEGRAM_API_HASH is required.');
  }

  if (!env.TELEGRAM_SESSION?.trim()) {
    throw new Error('TELEGRAM_SESSION is required. Run npm run telegram:login to create one.');
  }

  return {
    apiId: env.TELEGRAM_API_ID,
    apiHash: env.TELEGRAM_API_HASH,
    session: env.TELEGRAM_SESSION.trim()
  };
}

export function createTelegramClient() {
  const { apiId, apiHash, session } = getTelegramWorkerAuthConfig();
  return new TelegramClient(new StringSession(session), apiId, apiHash, {
    connectionRetries: 5
  });
}

export async function connectTelegramWorkerClient() {
  const client = createTelegramClient();
  await client.connect();

  if (!(await client.checkAuthorization())) {
    await client.disconnect();
    throw new Error('Telegram session is not authorized. Run npm run telegram:login first.');
  }

  return client;
}
