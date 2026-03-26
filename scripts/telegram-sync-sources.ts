import { resolve } from 'node:path';
import { loadEnvFiles } from './load-env';

await loadEnvFiles();

const [{ readTelegramSourceRegistry, syncTelegramSourceRegistry }] = await Promise.all([
  import('../lib/telegram/source-registry')
]);

const requestedPath = process.argv[2] || 'config/telegram-sources.json';
const filePath = resolve(process.cwd(), requestedPath);

const sources = await readTelegramSourceRegistry(filePath);
const synced = await syncTelegramSourceRegistry(sources);

console.log(`Synced ${synced.length} Telegram sources from ${filePath}`);

for (const source of synced) {
  const handle = source.telegram_username ? `@${source.telegram_username}` : source.telegram_channel_id;
  console.log(`- ${source.source_name} (${handle})`);
}
