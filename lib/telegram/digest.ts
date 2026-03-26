import type { PoolClient } from 'pg';
import { env } from '../env';
import { query, withTransaction } from '../db';
import { listPendingDigestClusters } from '../repository';
import type { TelegramClusterPreview } from '../types';
import { formatTelegramDigestTimestamp, limitTelegramDigestItems, rankTelegramDigestItems, trimTelegramDigestText } from './ranking';
import { summarizeTelegramDigestWithPicoclaw, type TelegramDigestAiResult } from './ai';

type Db = Pick<PoolClient, 'query'>;

export interface DigestRunRecord {
  id: string;
  destination: string;
  status: 'running' | 'sent' | 'failed';
}

export async function collectPendingDigestItems(limit = 12) {
  return listPendingDigestClusters(limit);
}

function buildFallbackTelegramDigestMessage(items: TelegramClusterPreview[]) {
  if (items.length === 0) {
    return 'No new high-signal Telegram clusters are waiting in the queue.';
  }

  const ranked = rankTelegramDigestItems(items);
  const lines: string[] = [
    'FrontRunMe Digest',
    '',
    `${ranked.length} fresh signal clusters, ranked by recency, urgency, then weightage.`,
    ''
  ];

  for (const [index, item] of ranked.entries()) {
    lines.push(
      `${index + 1}. ${item.sourceName} | ${item.category.toUpperCase()} | ${item.bias} | score ${Math.round(item.signalScore)} | ${item.corroborationCount} cites | ${formatTelegramDigestTimestamp(item.postedAt)}`,
      trimTelegramDigestText(item.summary ?? 'No summary yet.', 220),
      `Why it matters: ${trimTelegramDigestText(item.whyItMatters ?? 'Awaiting analyst review.', 220)}`,
      ''
    );
  }

  lines.push('Reply with "what’s important today?" in the bot for the latest verified context.');

  return lines.join('\n');
}

function buildAiDigestMessage(summary: TelegramDigestAiResult) {
  const lines: string[] = [summary.title, '', summary.intro, ''];

  for (const [index, item] of summary.items.entries()) {
    const source = item.sourceName;
    lines.push(
      `${index + 1}. ${source} | ${item.category.toUpperCase()} | ${item.bias} | score ${Math.round(item.signalScore)} | ${item.corroborationCount} cites | ${formatTelegramDigestTimestamp(item.postedAt)}`,
      trimTelegramDigestText(item.takeaway, 220),
      `Why it matters: ${trimTelegramDigestText(item.whyItMatters, 220)}`,
      ''
    );
  }

  if (summary.closing) {
    lines.push(summary.closing, '');
  }

  lines.push('Reply with "what’s important today?" in the bot for the latest verified context.');

  return lines.join('\n');
}

export async function buildTelegramDigestMessage(items: TelegramClusterPreview[]) {
  const ranked = rankTelegramDigestItems(items);
  const selected = limitTelegramDigestItems(ranked, env.TELEGRAM_DIGEST_CONTEXT_LIMIT);

  if (selected.length === 0) {
    return 'No new high-signal Telegram clusters are waiting in the queue.';
  }

  try {
    const aiSummary = await summarizeTelegramDigestWithPicoclaw(selected);
    if (aiSummary) {
      return buildAiDigestMessage(aiSummary);
    }
  } catch (error) {
    console.warn('Picoclaw digest generation failed, falling back to deterministic digest.', error);
  }

  return buildFallbackTelegramDigestMessage(selected);
}

export async function createDigestRun(db: Db, destination: string): Promise<DigestRunRecord> {
  const result = await db.query<DigestRunRecord>(
    `
      insert into digest_runs (destination, status)
      values ($1, 'running')
      returning id, destination, status
    `,
    [destination]
  );

  return result.rows[0];
}

export async function attachClustersToDigestRun(db: Db, input: { digestRunId: string; clusterIds: string[] }) {
  for (const clusterId of input.clusterIds) {
    await db.query(
      `
        insert into digest_run_items (digest_run_id, cluster_id)
        values ($1, $2)
        on conflict (digest_run_id, cluster_id) do nothing
      `,
      [input.digestRunId, clusterId]
    );
  }
}

export async function finalizeDigestRun(
  db: Db,
  input: {
    digestRunId: string;
    status: 'sent' | 'failed';
    itemCount: number;
    summaryText?: string | null;
    errorMessage?: string | null;
  }
) {
  await db.query(
    `
      update digest_runs
      set status = $2,
          item_count = $3,
          summary_text = $4,
          error_message = $5,
          sent_at = case when $2 = 'sent' then now() else sent_at end
      where id = $1
    `,
    [input.digestRunId, input.status, input.itemCount, input.summaryText ?? null, input.errorMessage ?? null]
  );
}

export async function markClustersDelivered(db: Db, clusterIds: string[]) {
  if (clusterIds.length === 0) {
    return;
  }

  await db.query(
    `
      update telegram_signal_clusters
      set delivery_status = 'sent',
          delivered_at = now(),
          updated_at = now()
      where id = any($1::uuid[])
    `,
    [clusterIds]
  );
}

export async function markClustersIgnored(db: Db, clusterIds: string[]) {
  if (clusterIds.length === 0) {
    return;
  }

  await db.query(
    `
      update telegram_signal_clusters
      set delivery_status = 'ignored',
          updated_at = now()
      where id = any($1::uuid[])
    `,
    [clusterIds]
  );
}

export async function sendDigestWithTracking(input: {
  destination: string;
  items: TelegramClusterPreview[];
  deliver: (message: string) => Promise<void>;
}) {
  const message = await buildTelegramDigestMessage(input.items);

  return withTransaction(async (db) => {
    const digestRun = await createDigestRun(db, input.destination);
    const clusterIds = rankTelegramDigestItems(input.items)
      .slice(0, env.TELEGRAM_DIGEST_CONTEXT_LIMIT)
      .map((item) => item.id);

    try {
      await attachClustersToDigestRun(db, {
        digestRunId: digestRun.id,
        clusterIds
      });
      await input.deliver(message);
      await markClustersDelivered(db, clusterIds);
      await finalizeDigestRun(db, {
        digestRunId: digestRun.id,
        status: 'sent',
        itemCount: clusterIds.length,
        summaryText: message
      });

      return { digestRunId: digestRun.id, message };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await finalizeDigestRun(db, {
        digestRunId: digestRun.id,
        status: 'failed',
        itemCount: clusterIds.length,
        summaryText: message,
        errorMessage
      });
      throw error;
    }
  });
}

export async function getLatestDigestSummary() {
  const result = await query<{ summary_text: string | null }>(
    `
      select summary_text
      from digest_runs
      where status = 'sent'
      order by sent_at desc nulls last, created_at desc
      limit 1
    `
  );

  return result.rows[0]?.summary_text ?? null;
}
