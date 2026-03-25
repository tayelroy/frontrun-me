import 'server-only';
import type { PoolClient } from 'pg';
import { query } from './db';
import type { AccessSnapshot, PreviewInsight, SignalBias, SignalCategory } from './types';

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
  input: { name: string; kind: 'rss' | 'api' | 'manual'; feedUrl?: string | null; isActive?: boolean }
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
