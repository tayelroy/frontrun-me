insert into app_users (id, wallet_address, telegram_handle, telegram_user_id)
values
  ('11111111-1111-1111-1111-111111111111', '0xf2913330bf7defc985618de15f16f0d0c2f69d6c', '@signalalpha', '9021001')
on conflict (wallet_address) do update
set telegram_handle = excluded.telegram_handle,
    telegram_user_id = excluded.telegram_user_id,
    updated_at = now();

insert into news_sources (id, name, kind, feed_url, is_active)
values
  ('22222222-2222-2222-2222-222222222221', 'The Block', 'rss', 'https://www.theblock.co/rss.xml', true),
  ('22222222-2222-2222-2222-222222222222', 'CoinDesk', 'rss', 'https://www.coindesk.com/arc/outboundfeeds/rss/', true),
  ('22222222-2222-2222-2222-222222222223', 'Decrypt', 'rss', 'https://decrypt.co/feed', true)
on conflict (name) do update
set kind = excluded.kind,
    feed_url = excluded.feed_url,
    is_active = excluded.is_active;

insert into news_articles (id, source_id, title, url, published_at, content, dedupe_key, raw_payload)
values
  (
    '33333333-3333-3333-3333-333333333331',
    '22222222-2222-2222-2222-222222222221',
    'ETH ETF chatter returns to the market',
    'https://example.com/news/eth-etf-chatter',
    now() - interval '1 hour',
    'Analysts noted renewed ETF-related headlines around ETH ecosystem assets.',
    'theblock-eth-etf-chatter',
    '{"source":"seed","category":"macro"}'::jsonb
  ),
  (
    '33333333-3333-3333-3333-333333333332',
    '22222222-2222-2222-2222-222222222222',
    'Exchange exploit rumor spreads across social feeds',
    'https://example.com/news/exchange-exploit-rumor',
    now() - interval '35 minutes',
    'Multiple channels reported a possible exploit surface under investigation.',
    'coindesk-exchange-exploit-rumor',
    '{"source":"seed","category":"exploit"}'::jsonb
  ),
  (
    '33333333-3333-3333-3333-333333333333',
    '22222222-2222-2222-2222-222222222223',
    'Chain partnership expands distribution reach',
    'https://example.com/news/chain-partnership',
    now() - interval '20 minutes',
    'A new chain partnership could improve distribution if usage follows.',
    'decrypt-chain-partnership',
    '{"source":"seed","category":"partnership"}'::jsonb
  )
on conflict (dedupe_key) do update
set source_id = excluded.source_id,
    title = excluded.title,
    url = excluded.url,
    published_at = excluded.published_at,
    content = excluded.content,
    raw_payload = excluded.raw_payload;

insert into news_insights (id, article_id, category, bias, score, summary, why_it_matters, tags, status, published_at)
values
  (
    '44444444-4444-4444-4444-444444444441',
    '33333333-3333-3333-3333-333333333331',
    'macro',
    'bullish',
    88,
    'ETH narrative momentum is picking back up after ETF-related headlines resurfaced.',
    'Narrative rotation can cause fast liquidity inflows across ETH beta assets.',
    '["eth","etf","macro"]'::jsonb,
    'published',
    now() - interval '55 minutes'
  ),
  (
    '44444444-4444-4444-4444-444444444442',
    '33333333-3333-3333-3333-333333333332',
    'exploit',
    'urgent',
    96,
    'Possible exploit chatter is creating immediate risk-off conditions.',
    'Security rumors often produce volatility before the facts are fully confirmed.',
    '["security","risk","urgent"]'::jsonb,
    'published',
    now() - interval '30 minutes'
  ),
  (
    '44444444-4444-4444-4444-444444444443',
    '33333333-3333-3333-3333-333333333333',
    'partnership',
    'neutral',
    73,
    'The partnership may widen reach, but the market still needs usage evidence.',
    'Distribution headlines matter most when they convert into real onchain activity.',
    '["partnership","watchlist"]'::jsonb,
    'published',
    now() - interval '15 minutes'
  )
on conflict (article_id) do update
set category = excluded.category,
    bias = excluded.bias,
    score = excluded.score,
    summary = excluded.summary,
    why_it_matters = excluded.why_it_matters,
    tags = excluded.tags,
    status = excluded.status,
    published_at = excluded.published_at,
    updated_at = now();

insert into payment_sessions (id, user_id, wallet_address, chain, amount, currency, reference, status, transaction_hash)
values
  (
    '55555555-5555-5555-5555-555555555551',
    '11111111-1111-1111-1111-111111111111',
    '0xf2913330bf7defc985618de15f16f0d0c2f69d6c',
    'base',
    '49',
    'USDC',
    'seed-payment-001',
    'paid',
    '0xseedtx000000000000000000000000000000000001'
  )
on conflict (reference) do update
set status = excluded.status,
    transaction_hash = excluded.transaction_hash,
    updated_at = now();

insert into telegram_invites (id, user_id, channel_id, invite_link, invite_token, single_use, revoked_at)
values
  (
    '66666666-6666-6666-6666-666666666661',
    '11111111-1111-1111-1111-111111111111',
    '-1002468001234',
    'https://t.me/+seed-invite-link',
    'seed-invite-token',
    true,
    null
  )
on conflict (invite_link) do update
set invite_token = excluded.invite_token,
    revoked_at = excluded.revoked_at;

insert into access_grants (id, user_id, payment_session_id, telegram_invite_id, granted_at, expires_at)
values
  (
    '77777777-7777-7777-7777-777777777771',
    '11111111-1111-1111-1111-111111111111',
    '55555555-5555-5555-5555-555555555551',
    '66666666-6666-6666-6666-666666666661',
    now() - interval '10 minutes',
    null
  )
on conflict (telegram_invite_id) do update
set granted_at = excluded.granted_at,
    expires_at = excluded.expires_at;

insert into delivery_events (id, news_insight_id, destination, status, sent_at)
values
  (
    '88888888-8888-8888-8888-888888888881',
    '44444444-4444-4444-4444-444444444441',
    'telegram:-1002468001234',
    'sent',
    now() - interval '9 minutes'
  )
on conflict (id) do nothing;

insert into telegram_sources (
  id,
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
values
  (
    '99999999-9999-9999-9999-999999999991',
    'Whale Wire Daily',
    '-1003000000001',
    'whalewiredaily',
    'user_session',
    'premium',
    95,
    'macro',
    true,
    18342,
    now() - interval '6 minutes'
  ),
  (
    '99999999-9999-9999-9999-999999999992',
    'Onchain Risk Watch',
    '-1003000000002',
    'onchainriskwatch',
    'bot',
    'premium',
    100,
    'exploit',
    true,
    9281,
    now() - interval '3 minutes'
  ),
  (
    '99999999-9999-9999-9999-999999999993',
    'Token Catalyst Radar',
    '-1003000000003',
    'tokencatalystradar',
    'user_session',
    'preview',
    82,
    'partnership',
    true,
    5512,
    now() - interval '12 minutes'
  )
on conflict (telegram_channel_id) do update
set source_name = excluded.source_name,
    telegram_username = excluded.telegram_username,
    access_mode = excluded.access_mode,
    tier = excluded.tier,
    priority = excluded.priority,
    category = excluded.category,
    is_active = excluded.is_active,
    last_processed_message_id = excluded.last_processed_message_id,
    last_seen_at = excluded.last_seen_at,
    updated_at = now();

insert into telegram_ingestion_runs (
  id,
  source_id,
  started_at,
  completed_at,
  status,
  fetched_count,
  inserted_count,
  deduped_count,
  error_message
)
values
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    '99999999-9999-9999-9999-999999999991',
    now() - interval '7 minutes',
    now() - interval '6 minutes',
    'completed',
    18,
    5,
    13,
    null
  ),
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
    '99999999-9999-9999-9999-999999999992',
    now() - interval '4 minutes',
    now() - interval '3 minutes',
    'completed',
    9,
    4,
    5,
    null
  ),
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3',
    '99999999-9999-9999-9999-999999999993',
    now() - interval '15 minutes',
    now() - interval '12 minutes',
    'failed',
    11,
    2,
    3,
    'Channel rate limit encountered during backfill.'
  )
on conflict (id) do nothing;

insert into telegram_messages (
  id,
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
values
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1',
    '99999999-9999-9999-9999-999999999992',
    9278,
    null,
    now() - interval '31 minutes',
    'Risk Watch Bot',
    'Urgent: bridge exploit rumor spreading after suspicious treasury outflows. https://example.com/bridge-alert',
    'urgent bridge exploit rumor spreading after suspicious treasury outflows https://example.com/bridge-alert',
    'hash-bridge-exploit-1',
    'dedupe-bridge-exploit',
    'text',
    null,
    null,
    '{"seed": true}'::jsonb,
    '["https://example.com/bridge-alert"]'::jsonb,
    '["security","bridge","urgent"]'::jsonb,
    true
  ),
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2',
    '99999999-9999-9999-9999-999999999991',
    18338,
    null,
    now() - interval '29 minutes',
    'Macro Desk',
    'ETF desks seeing renewed ETH chatter this afternoon. https://example.com/eth-etf-flow',
    'etf desks seeing renewed eth chatter this afternoon https://example.com/eth-etf-flow',
    'hash-eth-etf-1',
    'dedupe-eth-etf',
    'text',
    null,
    null,
    '{"seed": true}'::jsonb,
    '["https://example.com/eth-etf-flow"]'::jsonb,
    '["eth","etf","macro"]'::jsonb,
    true
  ),
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3',
    '99999999-9999-9999-9999-999999999993',
    5509,
    null,
    now() - interval '18 minutes',
    'Catalyst Radar',
    'Layer-2 partnership announced with payment app distribution, details still thin.',
    'layer-2 partnership announced with payment app distribution details still thin',
    'hash-partnership-1',
    'dedupe-layer2-partnership',
    'text',
    null,
    null,
    '{"seed": true}'::jsonb,
    '[]'::jsonb,
    '["partnership","distribution"]'::jsonb,
    true
  ),
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4',
    '99999999-9999-9999-9999-999999999992',
    9279,
    null,
    now() - interval '28 minutes',
    'Risk Watch Bot',
    'Second source now confirms abnormal bridge wallet movements. https://example.com/bridge-follow-up',
    'second source now confirms abnormal bridge wallet movements https://example.com/bridge-follow-up',
    'hash-bridge-exploit-2',
    'dedupe-bridge-exploit',
    'text',
    null,
    null,
    '{"seed": true}'::jsonb,
    '["https://example.com/bridge-follow-up"]'::jsonb,
    '["security","corroboration"]'::jsonb,
    true
  )
on conflict (source_id, telegram_message_id) do update
set posted_at = excluded.posted_at,
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
    is_candidate = excluded.is_candidate;

insert into telegram_signal_clusters (
  id,
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
values
  (
    'cccccccc-cccc-cccc-cccc-ccccccccccc1',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1',
    'cluster-bridge-exploit',
    'exploit',
    'urgent',
    96,
    2,
    'reviewed',
    'Bridge exploit chatter is now corroborated by multiple monitored Telegram channels.',
    'Security headlines with treasury movement confirmation tend to create immediate risk-off reactions.',
    '33333333-3333-3333-3333-333333333332'
  ),
  (
    'cccccccc-cccc-cccc-cccc-ccccccccccc2',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2',
    'cluster-eth-etf',
    'macro',
    'bullish',
    84,
    1,
    'queued',
    'ETH ETF-related chatter is picking up again across monitored macro channels.',
    'ETF narratives can pull short-term liquidity into ETH beta names before broader media catches up.',
    null
  ),
  (
    'cccccccc-cccc-cccc-cccc-ccccccccccc3',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3',
    'cluster-layer2-partnership',
    'partnership',
    'neutral',
    68,
    1,
    'queued',
    'A Layer-2 distribution partnership is being discussed, but hard traction data is still missing.',
    'Partnership headlines matter when they produce measurable usage, not just announcements.',
    null
  )
on conflict (cluster_fingerprint) do update
set canonical_message_id = excluded.canonical_message_id,
    category = excluded.category,
    bias = excluded.bias,
    signal_score = excluded.signal_score,
    corroboration_count = excluded.corroboration_count,
    status = excluded.status,
    summary = excluded.summary,
    why_it_matters = excluded.why_it_matters,
    promoted_article_id = excluded.promoted_article_id,
    updated_at = now();

insert into telegram_cluster_messages (cluster_id, message_id, is_canonical)
values
  ('cccccccc-cccc-cccc-cccc-ccccccccccc1', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', true),
  ('cccccccc-cccc-cccc-cccc-ccccccccccc1', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4', false),
  ('cccccccc-cccc-cccc-cccc-ccccccccccc2', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', true),
  ('cccccccc-cccc-cccc-cccc-ccccccccccc3', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3', true)
on conflict (cluster_id, message_id) do update
set is_canonical = excluded.is_canonical;
