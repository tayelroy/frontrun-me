import { query } from '../db';
import { env } from '../env';

export interface PromotedTelegramCluster {
  id: string;
  sourceName: string;
  signalScore: number;
  corroborationCount: number;
}

export async function promoteQueuedTelegramClusters(input?: {
  limit?: number;
  minScore?: number;
}): Promise<PromotedTelegramCluster[]> {
  const limit = Number.isFinite(input?.limit ?? NaN)
    ? Math.max(1, Math.floor(input?.limit ?? env.TELEGRAM_DIGEST_CONTEXT_LIMIT ?? 6))
    : Math.max(1, Math.floor(env.TELEGRAM_DIGEST_CONTEXT_LIMIT ?? 6));
  const minScore = Number.isFinite(input?.minScore ?? NaN) ? Number(input?.minScore) : 55;

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
    return [];
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

  return result.rows.map((row) => ({
    id: row.id,
    sourceName: row.source_name,
    signalScore: Number(row.signal_score),
    corroborationCount: Number(row.corroboration_count)
  }));
}
