import { loadEnvFiles } from './load-env';

await loadEnvFiles();

const [{ env }, { promoteQueuedTelegramClusters }] = await Promise.all([
  import('../lib/env'),
  import('../lib/telegram/promote')
]);

const limitArg = Number(process.argv[2] ?? env.TELEGRAM_DIGEST_CONTEXT_LIMIT ?? 6);
const limit = Number.isFinite(limitArg) && limitArg > 0 ? Math.floor(limitArg) : 6;
const minScoreArg = Number(process.argv[3] ?? '55');
const minScore = Number.isFinite(minScoreArg) ? minScoreArg : 55;

const promoted = await promoteQueuedTelegramClusters({ limit, minScore });

if (promoted.length === 0) {
  console.log('No queued clusters met the promotion threshold.');
  process.exit(0);
}

for (const row of promoted) {
  console.log(
    `Promoted ${row.sourceName}: score=${row.signalScore.toFixed(0)} corroboration=${row.corroborationCount}`
  );
}

console.log(`Promoted ${promoted.length} cluster(s) to reviewed.`);
