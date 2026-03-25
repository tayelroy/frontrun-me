import type { PoolClient } from 'pg';
import { query } from '../db';
import type { SignalBias, SignalCategory, TelegramAccessMode, TelegramRunStatus, TelegramSourceTier } from '../types';

type Db = Pick<PoolClient, 'query'>;

export interface TelegramSourceRecord {
  id: string;
  sourceName: string;
  telegramChannelId: string;
  telegramUsername: string | null;
  accessMode: TelegramAccessMode;
  tier: TelegramSourceTier;
  priority: number;
  category: SignalCategory | null;
  isActive: boolean;
  lastProcessedMessageId: string | null;
  lastSeenAt: string | null;
}

export interface TelegramRunRecord {
  id: string;
  sourceId: string;
  status: TelegramRunStatus;
}

export async function listActiveTelegramSources(): Promise<TelegramSourceRecord[]> {
  const result = await query<TelegramSourceRecord>(
    `
      select
        id,
        source_name as "sourceName",
        telegram_channel_id as "telegramChannelId",
        telegram_username as "telegramUsername",
        access_mode as "accessMode",
        tier,
        priority,
        category,
        is_active as "isActive",
        last_processed_message_id::text as "lastProcessedMessageId",
        last_seen_at::text as "lastSeenAt"
      from telegram_sources
      where is_active = true
      order by priority desc, source_name asc
    `
  );

  return result.rows;
}

export async function createTelegramIngestionRun(
  db: Db,
  input: { sourceId: string; startedAt?: string | null }
): Promise<TelegramRunRecord> {
  const result = await db.query<TelegramRunRecord>(
    `
      insert into telegram_ingestion_runs (source_id, started_at, status)
      values ($1, coalesce($2::timestamptz, now()), 'running')
      returning id, source_id as "sourceId", status
    `,
    [input.sourceId, input.startedAt ?? null]
  );

  return result.rows[0];
}

export async function finalizeTelegramIngestionRun(
  db: Db,
  input: {
    runId: string;
    status: TelegramRunStatus;
    completedAt?: string | null;
    fetchedCount?: number;
    insertedCount?: number;
    dedupedCount?: number;
    errorMessage?: string | null;
  }
) {
  const result = await db.query(
    `
      update telegram_ingestion_runs
      set completed_at = $2,
          status = $3,
          fetched_count = $4,
          inserted_count = $5,
          deduped_count = $6,
          error_message = $7
      where id = $1
      returning *
    `,
    [
      input.runId,
      input.completedAt ?? null,
      input.status,
      input.fetchedCount ?? 0,
      input.insertedCount ?? 0,
      input.dedupedCount ?? 0,
      input.errorMessage ?? null
    ]
  );

  return result.rows[0];
}

export async function persistTelegramMessage(
  db: Db,
  input: {
    sourceId: string;
    telegramMessageId: number;
    groupedId?: number | null;
    postedAt: string;
    senderName?: string | null;
    messageText?: string | null;
    normalizedText: string;
    contentHash: string;
    dedupeKey: string;
    mediaKind?: string | null;
    forwardedFrom?: string | null;
    replyToMessageId?: number | null;
    rawPayload?: Record<string, unknown>;
    extractedLinks?: string[];
    tags?: string[];
    isCandidate?: boolean;
  }
) {
  const result = await db.query(
    `
      insert into telegram_messages (
        source_id,
        telegram_message_id,
        grouped_id,
        posted_at,
        sender_name,
        message_text,
        normalized_text,
        content_hash,
        dedupe_key,
        media_kind,
        forwarded_from,
        reply_to_message_id,
        raw_payload,
        extracted_links,
        tags,
        is_candidate
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      on conflict (source_id, telegram_message_id)
      do update set
        grouped_id = excluded.grouped_id,
        posted_at = excluded.posted_at,
        sender_name = excluded.sender_name,
        message_text = excluded.message_text,
        normalized_text = excluded.normalized_text,
        content_hash = excluded.content_hash,
        dedupe_key = excluded.dedupe_key,
        media_kind = excluded.media_kind,
        forwarded_from = excluded.forwarded_from,
        reply_to_message_id = excluded.reply_to_message_id,
        raw_payload = excluded.raw_payload,
        extracted_links = excluded.extracted_links,
        tags = excluded.tags,
        is_candidate = excluded.is_candidate
      returning *
    `,
    [
      input.sourceId,
      input.telegramMessageId,
      input.groupedId ?? null,
      input.postedAt,
      input.senderName ?? null,
      input.messageText ?? null,
      input.normalizedText,
      input.contentHash,
      input.dedupeKey,
      input.mediaKind ?? null,
      input.forwardedFrom ?? null,
      input.replyToMessageId ?? null,
      input.rawPayload ?? {},
      JSON.stringify(input.extractedLinks ?? []),
      JSON.stringify(input.tags ?? []),
      input.isCandidate ?? true
    ]
  );

  return result.rows[0];
}

export async function upsertTelegramCluster(
  db: Db,
  input: {
    canonicalMessageId: string;
    clusterFingerprint: string;
    category: SignalCategory;
    bias: SignalBias;
    signalScore: number;
    corroborationCount?: number;
    status?: 'queued' | 'reviewed' | 'promoted' | 'published' | 'discarded';
    summary?: string | null;
    whyItMatters?: string | null;
    promotedArticleId?: string | null;
  }
) {
  const result = await db.query(
    `
      insert into telegram_signal_clusters (
        canonical_message_id,
        cluster_fingerprint,
        category,
        bias,
        signal_score,
        corroboration_count,
        status,
        summary,
        why_it_matters,
        promoted_article_id
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      on conflict (cluster_fingerprint)
      do update set
        canonical_message_id = coalesce(telegram_signal_clusters.canonical_message_id, excluded.canonical_message_id),
        category = excluded.category,
        bias = excluded.bias,
        signal_score = greatest(telegram_signal_clusters.signal_score, excluded.signal_score),
        corroboration_count = telegram_signal_clusters.corroboration_count + excluded.corroboration_count,
        status = case
          when telegram_signal_clusters.status in ('promoted', 'published') then telegram_signal_clusters.status
          else excluded.status
        end,
        summary = coalesce(telegram_signal_clusters.summary, excluded.summary),
        why_it_matters = coalesce(telegram_signal_clusters.why_it_matters, excluded.why_it_matters),
        promoted_article_id = coalesce(telegram_signal_clusters.promoted_article_id, excluded.promoted_article_id),
        updated_at = now()
      returning *
    `,
    [
      input.canonicalMessageId,
      input.clusterFingerprint,
      input.category,
      input.bias,
      input.signalScore,
      input.corroborationCount ?? 1,
      input.status ?? 'queued',
      input.summary ?? null,
      input.whyItMatters ?? null,
      input.promotedArticleId ?? null
    ]
  );

  return result.rows[0];
}

export async function attachTelegramMessageToCluster(
  db: Db,
  input: { clusterId: string; messageId: string; isCanonical?: boolean }
) {
  const result = await db.query(
    `
      insert into telegram_cluster_messages (cluster_id, message_id, is_canonical)
      values ($1, $2, $3)
      on conflict (cluster_id, message_id)
      do update set
        is_canonical = excluded.is_canonical
      returning *
    `,
    [input.clusterId, input.messageId, input.isCanonical ?? false]
  );

  return result.rows[0];
}

export async function updateTelegramSourceCursor(
  db: Db,
  input: { sourceId: string; lastProcessedMessageId?: number | null; lastSeenAt?: string | null }
) {
  const result = await db.query(
    `
      update telegram_sources
      set last_processed_message_id = case
            when $2::bigint is null then last_processed_message_id
            when last_processed_message_id is null then $2::bigint
            else greatest(last_processed_message_id, $2::bigint)
          end,
          last_seen_at = coalesce($3::timestamptz, last_seen_at, now()),
          updated_at = now()
      where id = $1
      returning *
    `,
    [input.sourceId, input.lastProcessedMessageId ?? null, input.lastSeenAt ?? null]
  );

  return result.rows[0];
}
