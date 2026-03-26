import { loadEnvFiles } from './load-env';

await loadEnvFiles();

const [{ query }, { env }] = await Promise.all([import('../lib/db'), import('../lib/env')]);

const limitArg = Number(process.argv[2] ?? env.TELEGRAM_DIGEST_CONTEXT_LIMIT ?? 6);
const limit = Number.isFinite(limitArg) && limitArg > 0 ? Math.floor(limitArg) : 6;
const minScoreArg = Number(process.argv[3] ?? '55');
const minScore = Number.isFinite(minScoreArg) ? minScoreArg : 55;

const result = await query<{
  id: string;
  source_name: string;
  signal_score: string;
  corroboration_count: string;
}>(
  `
    select
      tsc.id,
      ts.source_name,
      tsc.signal_score::text as signal_score,
      tsc.corroboration_count::text as corroboration_count
    from telegram_signal_clusters tsc
    join telegram_messages tm on tm.id = tsc.canonical_message_id
    join telegram_sources ts on ts.id = tm.source_id
    where tsc.delivery_status = 'new'
      and tsc.status = 'queued'
      and (
        tsc.signal_score >= $2
        or tsc.corroboration_count > 1
      )
    order by tsc.signal_score desc, tsc.corroboration_count desc, tm.posted_at desc
    limit $1
  `,
  [limit, minScore]
);

if (result.rows.length === 0) {
  console.log('No queued clusters met the promotion threshold.');
  process.exit(0);
}

const ids = result.rows.map((row) => row.id);

await query(
  `
    update telegram_signal_clusters
    set status = 'reviewed',
        updated_at = now()
    where id = any($1::uuid[])
  `,
  [ids]
);

for (const row of result.rows) {
  console.log(
    `Promoted ${row.source_name}: score=${Number(row.signal_score).toFixed(0)} corroboration=${Number(row.corroboration_count)}`
  );
}

console.log(`Promoted ${result.rows.length} cluster(s) to reviewed.`);
