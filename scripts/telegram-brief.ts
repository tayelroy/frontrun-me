import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadEnvFiles } from './load-env';

await loadEnvFiles();

const [
  { env },
  { readTelegramSourceRegistry, syncTelegramSourceRegistry },
  { connectTelegramWorkerClient },
  { ingestTelegramSources },
  { promoteQueuedTelegramClusters },
  { collectPendingDigestItems, sendDigestWithTracking }
] = await Promise.all([
  import('../lib/env'),
  import('../lib/telegram/source-registry'),
  import('../lib/telegram/client'),
  import('../lib/telegram/ingest'),
  import('../lib/telegram/promote'),
  import('../lib/telegram/digest')
]);

if (!env.TELEGRAM_BOT_TOKEN) {
  throw new Error('TELEGRAM_BOT_TOKEN is required in .env or .env.local.');
}

if (!env.TELEGRAM_DIGEST_CHAT_ID) {
  throw new Error('TELEGRAM_DIGEST_CHAT_ID is required in .env or .env.local.');
}

const registryPath = resolve(process.cwd(), 'config/telegram-sources.json');

try {
  await access(registryPath);
  console.log('Step 0/4: syncing Telegram source registry...');
  const sources = await readTelegramSourceRegistry(registryPath);
  const synced = await syncTelegramSourceRegistry(sources);
  console.log(`Synced ${synced.length} source(s) from config/telegram-sources.json.`);
} catch (error) {
  if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
    console.log('Step 0/4: no config/telegram-sources.json found, using existing database sources.');
  } else {
    throw error;
  }
}

const ingestClient = await connectTelegramWorkerClient();

try {
  console.log('Step 1/4: ingesting Telegram sources...');
  const ingestResults = await ingestTelegramSources(ingestClient, {});

  for (const result of ingestResults) {
    const summary = [
      `${result.sourceName}`,
      `status=${result.status}`,
      `fetched=${result.fetchedCount}`,
      `inserted=${result.insertedCount}`,
      `deduped=${result.dedupedCount}`,
      `clusters=${result.clusterCount}`
    ].join(' ');

    console.log(summary);

    if (result.errorMessage) {
      console.error(`  error: ${result.errorMessage}`);
    }
  }

  const failedResults = ingestResults.filter((result) => result.status === 'failed');
  if (failedResults.length > 0) {
    const firstError = failedResults[0]?.errorMessage ?? 'Telegram ingestion failed.';

    if (firstError.includes('column "') && firstError.includes('telegram_signal_clusters')) {
      throw new Error(
        `Telegram ingest is using a newer schema than your database. Run "npm run db:init" and retry. First failure: ${firstError}`
      );
    }

    throw new Error(
      `Telegram ingest failed for ${failedResults.length} source(s). First failure: ${firstError}`
    );
  }
} finally {
  await ingestClient.destroy().catch(() => null);
}

const promotionLimit = Number(env.TELEGRAM_DIGEST_CONTEXT_LIMIT ?? 6);
const promoted = await promoteQueuedTelegramClusters({
  limit: Number.isFinite(promotionLimit) && promotionLimit > 0 ? Math.floor(promotionLimit) : 6,
  minScore: 55
});

if (promoted.length === 0) {
  console.log('Step 2/4: no queued clusters met the promotion threshold.');
} else {
  console.log(`Step 2/4: promoted ${promoted.length} cluster(s) to reviewed.`);
  for (const row of promoted) {
    console.log(
      `  ${row.sourceName}: score=${row.signalScore.toFixed(0)} corroboration=${row.corroborationCount}`
    );
  }
}

console.log('Step 3/4: building digest with Picoclaw...');
const items = await collectPendingDigestItems(12);

if (items.length === 0) {
  console.log('No new Telegram clusters are ready for digest delivery.');
  process.exit(0);
}

const result = await sendDigestWithTracking({
  destination: env.TELEGRAM_DIGEST_CHAT_ID,
  items,
  deliver: async (message) => {
    const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chat_id: env.TELEGRAM_DIGEST_CHAT_ID,
        text: message,
        disable_web_page_preview: true
      })
    });

    if (!response.ok) {
      throw new Error(`Telegram Bot API request failed: ${response.status}`);
    }
  }
});

console.log('Step 4/4: digest sent.');
console.log('');
console.log('=== Telegram Brief ===');
console.log(result.message);
