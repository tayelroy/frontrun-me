import { loadEnvFiles } from './load-env';

await loadEnvFiles();

const [{ connectTelegramWorkerClient }, { ingestTelegramSources }] = await Promise.all([
  import('../lib/telegram/client'),
  import('../lib/telegram/ingest')
]);

const sourceFilter = process.argv.slice(2).filter(Boolean);
const client = await connectTelegramWorkerClient();

try {
  const results = await ingestTelegramSources(client, { sourceFilter });

  for (const result of results) {
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
} finally {
  await client.disconnect().catch(() => null);
}
