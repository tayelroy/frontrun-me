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
