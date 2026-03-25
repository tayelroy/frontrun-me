create extension if not exists pgcrypto;

create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  wallet_address text not null unique,
  telegram_handle text,
  telegram_user_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists news_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  kind text not null check (kind in ('rss', 'api', 'manual', 'telegram')),
  feed_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists news_articles (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references news_sources(id) on delete cascade,
  title text not null,
  url text not null,
  published_at timestamptz not null,
  content text,
  dedupe_key text not null unique,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists news_articles_published_at_idx on news_articles (published_at desc);

create table if not exists news_insights (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null unique references news_articles(id) on delete cascade,
  category text not null check (category in ('exploit', 'regulation', 'partnership', 'macro', 'listing', 'fundraising', 'watchlist')),
  bias text not null check (bias in ('bullish', 'bearish', 'neutral', 'urgent')),
  score numeric(5,2) not null default 0,
  summary text not null,
  why_it_matters text not null,
  tags jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists news_insights_status_idx on news_insights (status, published_at desc);

create table if not exists payment_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  wallet_address text not null,
  chain text not null,
  amount text not null,
  currency text not null,
  reference text not null unique,
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'refunded')),
  transaction_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payment_sessions_wallet_idx on payment_sessions (wallet_address, status);

create table if not exists telegram_invites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  channel_id text not null,
  invite_link text not null unique,
  invite_token text not null unique,
  single_use boolean not null default true,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists access_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  payment_session_id uuid not null references payment_sessions(id) on delete cascade,
  telegram_invite_id uuid not null unique references telegram_invites(id) on delete cascade,
  granted_at timestamptz not null default now(),
  expires_at timestamptz
);

create table if not exists delivery_events (
  id uuid primary key default gen_random_uuid(),
  news_insight_id uuid not null references news_insights(id) on delete cascade,
  destination text not null,
  status text not null check (status in ('queued', 'sent', 'failed')),
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists telegram_sources (
  id uuid primary key default gen_random_uuid(),
  source_name text not null,
  telegram_channel_id text not null unique,
  telegram_username text,
  access_mode text not null check (access_mode in ('bot', 'user_session', 'manual')),
  tier text not null default 'premium' check (tier in ('preview', 'premium', 'internal')),
  priority integer not null default 50,
  category text,
  is_active boolean not null default true,
  last_processed_message_id bigint,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists telegram_sources_active_priority_idx on telegram_sources (is_active, priority desc);

create table if not exists telegram_ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references telegram_sources(id) on delete cascade,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'running' check (status in ('running', 'completed', 'failed')),
  fetched_count integer not null default 0,
  inserted_count integer not null default 0,
  deduped_count integer not null default 0,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists telegram_ingestion_runs_source_started_idx on telegram_ingestion_runs (source_id, started_at desc);

create table if not exists telegram_messages (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references telegram_sources(id) on delete cascade,
  telegram_message_id bigint not null,
  grouped_id bigint,
  posted_at timestamptz not null,
  sender_name text,
  message_text text,
  normalized_text text not null,
  content_hash text not null,
  dedupe_key text not null,
  media_kind text,
  forwarded_from text,
  reply_to_message_id bigint,
  raw_payload jsonb not null default '{}'::jsonb,
  extracted_links jsonb not null default '[]'::jsonb,
  tags jsonb not null default '[]'::jsonb,
  is_candidate boolean not null default true,
  created_at timestamptz not null default now(),
  unique (source_id, telegram_message_id)
);

create index if not exists telegram_messages_posted_at_idx on telegram_messages (posted_at desc);
create index if not exists telegram_messages_dedupe_key_idx on telegram_messages (dedupe_key);

create table if not exists telegram_signal_clusters (
  id uuid primary key default gen_random_uuid(),
  canonical_message_id uuid references telegram_messages(id) on delete set null,
  cluster_fingerprint text not null unique,
  category text not null check (category in ('exploit', 'regulation', 'partnership', 'macro', 'listing', 'fundraising', 'watchlist')),
  bias text not null check (bias in ('bullish', 'bearish', 'neutral', 'urgent')),
  signal_score numeric(5,2) not null default 0,
  corroboration_count integer not null default 1,
  status text not null default 'queued' check (status in ('queued', 'reviewed', 'promoted', 'published', 'discarded')),
  summary text,
  why_it_matters text,
  promoted_article_id uuid references news_articles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists telegram_signal_clusters_status_idx on telegram_signal_clusters (status, updated_at desc);

create table if not exists telegram_cluster_messages (
  cluster_id uuid not null references telegram_signal_clusters(id) on delete cascade,
  message_id uuid not null references telegram_messages(id) on delete cascade,
  is_canonical boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (cluster_id, message_id)
);
