import 'server-only';
import type { PoolClient } from 'pg';
import { query } from './db';
import type {
  AccessSnapshot,
  PreviewInsight,
  SignalBias,
  SignalCategory,
  TelegramAggregationOverview,
  TelegramClusterPreview,
  TelegramSourceConfig,
  TelegramSourceStatus
} from './types';

type Db = Pick<PoolClient, 'query'>;

export async function listPublishedInsights(limit = 6): Promise<PreviewInsight[]> {
  try {
    const result = await query<{
      id: string;
      title: string;
      category: SignalCategory;
      bias: SignalBias;
      summary: string;
      why_it_matters: string;
      score: string;
    }>(
      `
        select
          ni.id,
          na.title,
          ni.category,
          ni.bias,
          ni.summary,
          ni.why_it_matters,
          ni.score::text as score
        from news_insights ni
        join news_articles na on na.id = ni.article_id
        where ni.status = 'published'
        order by coalesce(ni.published_at, ni.updated_at) desc
        limit $1
      `,
      [limit]
    );

    return result.rows.map((row) => ({
      id: row.id,
      title: row.title,
      category: row.category,
      bias: row.bias,
      summary: row.summary,
      whyItMatters: row.why_it_matters,
      score: Number(row.score)
    }));
  } catch {
    return [];
  }
}

export async function getAccessByWallet(walletAddress: string): Promise<AccessSnapshot | null> {
  try {
    const result = await query<AccessSnapshot>(
      `
        select
          u.id as "userId",
          u.wallet_address as "walletAddress",
          u.telegram_handle as "telegramHandle",
          ps.reference as "paymentReference",
          ps.status as "paymentStatus",
          ti.invite_link as "inviteLink",
          ti.channel_id as "channelId",
          ti.revoked_at as "revokedAt",
          ag.granted_at as "grantedAt",
          ag.expires_at as "expiresAt"
        from app_users u
        left join payment_sessions ps on ps.user_id = u.id and ps.status = 'paid'
        left join access_grants ag on ag.user_id = u.id
        left join telegram_invites ti on ti.id = ag.telegram_invite_id
        where lower(u.wallet_address) = lower($1)
        order by coalesce(ag.granted_at, ps.updated_at, u.updated_at) desc
        limit 1
      `,
      [walletAddress]
    );

    return result.rows[0] ?? null;
  } catch {
    return null;
  }
}

export async function getDashboardStats() {
  try {
    const result = await query<{
      sources: string;
      articles: string;
      insights: string;
      paidSessions: string;
      activeGrants: string;
    }>(
      `
        select
          (select count(*) from news_sources) as sources,
          (select count(*) from news_articles) as articles,
          (select count(*) from news_insights) as insights,
          (select count(*) from payment_sessions where status = 'paid') as "paidSessions",
          (select count(*) from access_grants) as "activeGrants"
      `
    );

    return {
      sources: Number(result.rows[0]?.sources ?? 0),
      articles: Number(result.rows[0]?.articles ?? 0),
      insights: Number(result.rows[0]?.insights ?? 0),
      paidSessions: Number(result.rows[0]?.paidSessions ?? 0),
      activeGrants: Number(result.rows[0]?.activeGrants ?? 0)
    };
  } catch {
    return {
      sources: 0,
      articles: 0,
      insights: 0,
      paidSessions: 0,
      activeGrants: 0
    };
  }
}

export async function getTelegramAggregationOverview(): Promise<TelegramAggregationOverview> {
  try {
    const result = await query<{
      sources: string;
      active_sources: string;
      raw_messages: string;
      candidate_messages: string;
      clusters: string;
      promoted_clusters: string;
      completed_runs: string;
      failed_runs: string;
    }>(
      `
        select
          (select count(*) from telegram_sources) as sources,
          (select count(*) from telegram_sources where is_active = true) as active_sources,
          (select count(*) from telegram_messages) as raw_messages,
          (select count(*) from telegram_messages where is_candidate = true) as candidate_messages,
          (select count(*) from telegram_signal_clusters) as clusters,
          (select count(*) from telegram_signal_clusters where status in ('promoted', 'published')) as promoted_clusters,
          (select count(*) from telegram_ingestion_runs where status = 'completed') as completed_runs,
          (select count(*) from telegram_ingestion_runs where status = 'failed') as failed_runs
      `
    );

    return {
      sources: Number(result.rows[0]?.sources ?? 0),
      activeSources: Number(result.rows[0]?.active_sources ?? 0),
      rawMessages: Number(result.rows[0]?.raw_messages ?? 0),
      candidateMessages: Number(result.rows[0]?.candidate_messages ?? 0),
      clusters: Number(result.rows[0]?.clusters ?? 0),
      promotedClusters: Number(result.rows[0]?.promoted_clusters ?? 0),
      completedRuns: Number(result.rows[0]?.completed_runs ?? 0),
      failedRuns: Number(result.rows[0]?.failed_runs ?? 0)
    };
  } catch {
    return {
      sources: 0,
      activeSources: 0,
      rawMessages: 0,
      candidateMessages: 0,
      clusters: 0,
      promotedClusters: 0,
      completedRuns: 0,
      failedRuns: 0
    };
  }
}

export async function listTelegramSourceStatuses(limit = 8): Promise<TelegramSourceStatus[]> {
  try {
    const result = await query<TelegramSourceStatus & { fetchedCount: string; insertedCount: string; dedupedCount: string }>(
      `
        select
          ts.id,
          ts.source_name as "sourceName",
          ts.telegram_channel_id as "telegramChannelId",
          ts.telegram_username as "telegramUsername",
          ts.access_mode as "accessMode",
          ts.tier,
          ts.priority,
          coalesce(ts.category, 'watchlist') as category,
          ts.is_active as "isActive",
          ts.last_processed_message_id::text as "lastProcessedMessageId",
          ts.last_seen_at::text as "lastSeenAt",
          tir.status as "lastRunStatus",
          tir.completed_at::text as "lastRunCompletedAt",
          coalesce(tir.fetched_count, 0)::text as "fetchedCount",
          coalesce(tir.inserted_count, 0)::text as "insertedCount",
          coalesce(tir.deduped_count, 0)::text as "dedupedCount"
        from telegram_sources ts
        left join lateral (
          select status, completed_at, fetched_count, inserted_count, deduped_count
          from telegram_ingestion_runs tir
          where tir.source_id = ts.id
          order by tir.started_at desc
          limit 1
        ) tir on true
        order by ts.priority desc, ts.source_name asc
        limit $1
      `,
      [limit]
    );

    return result.rows.map((row) => ({
      ...row,
      fetchedCount: Number(row.fetchedCount),
      insertedCount: Number(row.insertedCount),
      dedupedCount: Number(row.dedupedCount)
    }));
  } catch {
    return [];
  }
}

export async function listActiveTelegramSources(limit = 25): Promise<TelegramSourceConfig[]> {
  try {
    const result = await query<TelegramSourceConfig>(
      `
        select
          id,
          source_name as "sourceName",
          telegram_channel_id as "telegramChannelId",
          telegram_username as "telegramUsername",
          access_mode as "accessMode",
          tier,
          priority,
          coalesce(category, 'watchlist') as category,
          last_processed_message_id::text as "lastProcessedMessageId",
          last_seen_at::text as "lastSeenAt"
        from telegram_sources
        where is_active = true
        order by priority desc, source_name asc
        limit $1
      `,
      [limit]
    );

    return result.rows;
  } catch {
    return [];
  }
}

export async function listTelegramClusters(limit = 6): Promise<TelegramClusterPreview[]> {
  try {
    const result = await query<{
      id: string;
      sourceName: string;
      category: SignalCategory;
      bias: SignalBias;
      signalScore: string;
      corroborationCount: string;
      status: TelegramClusterPreview['status'];
      summary: string | null;
      whyItMatters: string | null;
      postedAt: string;
    }>(
      `
        select
          tsc.id,
          ts.source_name as "sourceName",
          tsc.category,
          tsc.bias,
          tsc.signal_score::text as "signalScore",
          tsc.corroboration_count::text as "corroborationCount",
          tsc.status,
          tsc.summary,
          tsc.why_it_matters as "whyItMatters",
          tm.posted_at::text as "postedAt"
        from telegram_signal_clusters tsc
        join telegram_messages tm on tm.id = tsc.canonical_message_id
        join telegram_sources ts on ts.id = tm.source_id
        order by tm.posted_at desc
        limit $1
      `,
      [limit]
    );

    return result.rows.map((row) => ({
      ...row,
      signalScore: Number(row.signalScore),
      corroborationCount: Number(row.corroborationCount)
    }));
  } catch {
    return [];
  }
}

export async function createPaymentSession(
  db: Db,
  input: {
    userId: string;
    walletAddress: string;
    chain: string;
    amount: string;
    currency: string;
    reference: string;
  }
) {
  const result = await db.query(
    `
      insert into payment_sessions (user_id, wallet_address, chain, amount, currency, reference)
      values ($1, $2, $3, $4, $5, $6)
      on conflict (reference)
      do update set
        user_id = excluded.user_id,
        wallet_address = excluded.wallet_address,
        chain = excluded.chain,
        amount = excluded.amount,
        currency = excluded.currency,
        updated_at = now()
      returning *
    `,
    [input.userId, input.walletAddress.toLowerCase(), input.chain, input.amount, input.currency, input.reference]
  );

  return result.rows[0];
}

export async function upsertUser(
  db: Db,
  input: { walletAddress: string; telegramHandle?: string | null; telegramUserId?: string | null }
) {
  const result = await db.query(
    `
      insert into app_users (wallet_address, telegram_handle, telegram_user_id)
      values ($1, $2, $3)
      on conflict (wallet_address)
      do update set
        telegram_handle = coalesce(excluded.telegram_handle, app_users.telegram_handle),
        telegram_user_id = coalesce(excluded.telegram_user_id, app_users.telegram_user_id),
        updated_at = now()
      returning *
    `,
    [input.walletAddress.toLowerCase(), input.telegramHandle ?? null, input.telegramUserId ?? null]
  );

  return result.rows[0];
}

export async function markPaymentPaid(db: Db, input: { reference: string; transactionHash: string }) {
  const result = await db.query(
    `
      update payment_sessions
      set status = 'paid',
          transaction_hash = $2,
          updated_at = now()
      where reference = $1
      returning *
    `,
    [input.reference, input.transactionHash]
  );

  return result.rows[0];
}

export async function createTelegramInvite(
  db: Db,
  input: { userId: string; channelId: string; inviteLink: string; inviteToken: string }
) {
  const result = await db.query(
    `
      insert into telegram_invites (user_id, channel_id, invite_link, invite_token, single_use)
      values ($1, $2, $3, $4, true)
      returning *
    `,
    [input.userId, input.channelId, input.inviteLink, input.inviteToken]
  );

  return result.rows[0];
}

export async function grantAccess(
  db: Db,
  input: { userId: string; paymentSessionId: string; telegramInviteId: string; expiresAt?: string | null }
) {
  const result = await db.query(
    `
      insert into access_grants (user_id, payment_session_id, telegram_invite_id, expires_at)
      values ($1, $2, $3, $4)
      returning *
    `,
    [input.userId, input.paymentSessionId, input.telegramInviteId, input.expiresAt ?? null]
  );

  return result.rows[0];
}

export async function insertNewsSource(
  db: Db,
  input: { name: string; kind: 'rss' | 'api' | 'manual' | 'telegram'; feedUrl?: string | null; isActive?: boolean }
) {
  const result = await db.query(
    `
      insert into news_sources (name, kind, feed_url, is_active)
      values ($1, $2, $3, $4)
      on conflict (name)
      do update set
        kind = excluded.kind,
        feed_url = excluded.feed_url,
        is_active = excluded.is_active
      returning *
    `,
    [input.name, input.kind, input.feedUrl ?? null, input.isActive ?? true]
  );

  return result.rows[0];
}

export async function upsertTelegramSource(
  db: Db,
  input: {
    sourceName: string;
    telegramChannelId: string;
    telegramUsername?: string | null;
    accessMode: 'bot' | 'user_session' | 'manual';
    tier?: 'preview' | 'premium' | 'internal';
    priority?: number;
    category?: SignalCategory;
    isActive?: boolean;
    lastProcessedMessageId?: number | null;
    lastSeenAt?: string | null;
  }
) {
  const result = await db.query(
    `
      insert into telegram_sources (
        source_name,
        telegram_channel_id,
        telegram_username,
        access_mode,
        tier,
        priority,
        category,
        is_active,
        last_processed_message_id,
        last_seen_at
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      on conflict (telegram_channel_id)
      do update set
        source_name = excluded.source_name,
        telegram_username = excluded.telegram_username,
        access_mode = excluded.access_mode,
        tier = excluded.tier,
        priority = excluded.priority,
        category = excluded.category,
        is_active = excluded.is_active,
        last_processed_message_id = coalesce(excluded.last_processed_message_id, telegram_sources.last_processed_message_id),
        last_seen_at = coalesce(excluded.last_seen_at, telegram_sources.last_seen_at),
        updated_at = now()
      returning *
    `,
    [
      input.sourceName,
      input.telegramChannelId,
      input.telegramUsername ?? null,
      input.accessMode,
      input.tier ?? 'premium',
      input.priority ?? 50,
      input.category ?? 'watchlist',
      input.isActive ?? true,
      input.lastProcessedMessageId ?? null,
      input.lastSeenAt ?? null
    ]
  );

  return result.rows[0];
}

export async function recordTelegramIngestionRun(
  db: Db,
  input: {
    sourceId: string;
    startedAt?: string;
    completedAt?: string | null;
    status: 'running' | 'completed' | 'failed';
    fetchedCount?: number;
    insertedCount?: number;
    dedupedCount?: number;
    errorMessage?: string | null;
  }
) {
  const result = await db.query(
    `
      insert into telegram_ingestion_runs (
        source_id,
        started_at,
        completed_at,
        status,
        fetched_count,
        inserted_count,
        deduped_count,
        error_message
      )
      values ($1, coalesce($2::timestamptz, now()), $3, $4, $5, $6, $7, $8)
      returning *
    `,
    [
      input.sourceId,
      input.startedAt ?? null,
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

export async function insertTelegramMessage(
  db: Db,
  input: {
    sourceId: string;
    telegramMessageId: number;
    postedAt: string;
    groupedId?: number | null;
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
        canonical_message_id = excluded.canonical_message_id,
        category = excluded.category,
        bias = excluded.bias,
        signal_score = excluded.signal_score,
        corroboration_count = excluded.corroboration_count,
        status = excluded.status,
        summary = excluded.summary,
        why_it_matters = excluded.why_it_matters,
        promoted_article_id = excluded.promoted_article_id,
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
      set
        last_processed_message_id = coalesce($2, last_processed_message_id),
        last_seen_at = coalesce($3::timestamptz, last_seen_at),
        updated_at = now()
      where id = $1
      returning *
    `,
    [input.sourceId, input.lastProcessedMessageId ?? null, input.lastSeenAt ?? null]
  );

  return result.rows[0];
}

export async function insertNewsArticle(
  db: Db,
  input: {
    sourceId: string;
    title: string;
    url: string;
    publishedAt: string;
    content?: string | null;
    dedupeKey: string;
    rawPayload?: Record<string, unknown>;
  }
) {
  const result = await db.query(
    `
      insert into news_articles (source_id, title, url, published_at, content, dedupe_key, raw_payload)
      values ($1, $2, $3, $4, $5, $6, $7)
      on conflict (dedupe_key)
      do update set
        title = excluded.title,
        url = excluded.url,
        published_at = excluded.published_at,
        content = excluded.content,
        raw_payload = excluded.raw_payload
      returning *
    `,
    [
      input.sourceId,
      input.title,
      input.url,
      input.publishedAt,
      input.content ?? null,
      input.dedupeKey,
      input.rawPayload ?? {}
    ]
  );

  return result.rows[0];
}

export async function upsertNewsInsight(
  db: Db,
  input: {
    articleId: string;
    category: SignalCategory;
    bias: SignalBias;
    score: number;
    summary: string;
    whyItMatters: string;
    tags: string[];
    status?: 'draft' | 'published' | 'archived';
    publishedAt?: string | null;
  }
) {
  const result = await db.query(
    `
      insert into news_insights (article_id, category, bias, score, summary, why_it_matters, tags, status, published_at)
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      on conflict (article_id)
      do update set
        category = excluded.category,
        bias = excluded.bias,
        score = excluded.score,
        summary = excluded.summary,
        why_it_matters = excluded.why_it_matters,
        tags = excluded.tags,
        status = excluded.status,
        published_at = excluded.published_at,
        updated_at = now()
      returning *
    `,
    [
      input.articleId,
      input.category,
      input.bias,
      input.score,
      input.summary,
      input.whyItMatters,
      JSON.stringify(input.tags),
      input.status ?? 'draft',
      input.publishedAt ?? null
    ]
  );

  return result.rows[0];
}
