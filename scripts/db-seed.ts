import { access } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { loadEnvFiles } from './load-env';

const execFileAsync = promisify(execFile);

await loadEnvFiles();

async function runSeedSql() {
  await execFileAsync(process.execPath, ['scripts/run-sql.mjs', 'src/db/seed.sql'], {
    cwd: process.cwd(),
    env: process.env
  });
}

async function syncTelegramSourcesIfPresent() {
  const configPath = new URL('../config/telegram-sources.json', import.meta.url);
  const configFilePath = fileURLToPath(configPath);

  try {
    await access(configFilePath, fsConstants.F_OK);
  } catch {
    console.log('No config/telegram-sources.json found. Skipping Telegram source sync.');
    return;
  }

  const [{ readTelegramSourceRegistry, syncTelegramSourceRegistry }] = await Promise.all([
    import('../lib/telegram/source-registry')
  ]);

  const sources = await readTelegramSourceRegistry(configFilePath);
  const synced = await syncTelegramSourceRegistry(sources);

  console.log(`Synced ${synced.length} Telegram sources from config/telegram-sources.json`);
}

await runSeedSql();
await syncTelegramSourcesIfPresent();
