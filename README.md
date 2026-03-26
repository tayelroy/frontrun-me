# Signal Room

Telegram-native crypto intelligence built with Next.js and PostgreSQL.

## What is in the app

- a server-rendered landing page
- x402 payment webhook handling
- single-use Telegram invite persistence
- database-backed preview insights
- admin views for catalog, pricing, and forecasting

## Stack

- Next.js App Router
- React 19
- PostgreSQL via `pg`
- Zod for payload validation

## Project structure

- `app/` - routes, pages, and API handlers
- `components/` - shared UI frames
- `lib/` - database, repository, access-flow, and validation helpers
- `src/db/schema.sql` - PostgreSQL schema

The `src/` folder from the original scaffold is kept as legacy reference, but the live app now runs from `app/` and `lib/`.

## Setup

1. Install dependencies.
2. Set `DATABASE_URL`.
3. Run `npm run db:init`.
4. Run `npm run db:seed` if you want sample content immediately plus your local Telegram source registry, when `config/telegram-sources.json` exists.
5. Run `npm run dev`.

The database scripts use a small Node runner in `scripts/run-sql.mjs`, so you do not need the `psql` CLI installed locally.

## Real Telegram ingestion

This repo now includes a real Telegram worker path using a Telegram user-session client.

1. Set `TELEGRAM_API_ID` and `TELEGRAM_API_HASH` in `.env` or `.env.local`.
2. Run `npm run telegram:login` once to generate a `TELEGRAM_SESSION`.
3. Add that session string to `.env` or `.env.local`.
4. Copy `config/telegram-sources.example.json` to `config/telegram-sources.json` and add your real crypto channels.
5. Run `npm run db:seed` or `npm run telegram:sources` to sync all configured channels into `telegram_sources`.
6. Run `npm run telegram:ingest` to pull live messages into the database.
7. Run `npm run telegram:promote` to mark obvious high-signal clusters as reviewed.
8. Run `npm run telegram:digest` to send the current unsent cluster pool to your Telegram bot chat.
9. Set `PICOCLAW_SSH_TARGET` and `PICOCLAW_SSH_KEY` so the digest step can call `picoclaw agent -m` directly on your VM.
10. Verify the VM connection with `npm run picoclaw:check` before you try the digest.

Notes:

- This path is designed for channels your authenticated Telegram account is allowed to access.
- If a source has a public username, the worker can resolve it more reliably than a raw channel id alone.
- If you do not know the numeric channel id yet, you can use `telegramUsername` only. The sync script will create a stable synthetic source id like `telegram:@channelname`.
- The ingest worker only considers the last `TELEGRAM_INGEST_LOOKBACK_DAYS` days of history, defaulting to `7`.
- The digest AI step only sends the most recent `TELEGRAM_DIGEST_CONTEXT_LIMIT` clusters to Picoclaw for summarization, defaulting to `6`.
- The digest AI client uses SSH to run `picoclaw agent -m` on your VM. Set `PICOCLAW_SSH_TARGET` and `PICOCLAW_SSH_KEY` in `.env` or `.env.local`.
- `npm run picoclaw:check` sends a small probe through that SSH path and is the quickest way to verify the VM side is reachable.
- `db:seed` will sync `config/telegram-sources.json` automatically if the file exists.
- You can target a subset of sources with `npm run telegram:ingest -- <name-or-username>`.
- Digest delivery requires `TELEGRAM_BOT_TOKEN` and `TELEGRAM_DIGEST_CHAT_ID`.
- If the SSH path fails, the digest falls back to the deterministic non-AI formatter.

## Hosted Postgres

Recommended path: Supabase.

1. Create a new Supabase project.
2. Open the project dashboard and click `Connect`.
3. Copy the connection string from the direct connection or session pooler section.
4. Put that value into `DATABASE_URL` in your local `.env` file.
5. Run `npm run db:init` and `npm run db:seed`.

For this app, a normal hosted Postgres connection is enough. The server reads `DATABASE_URL` and uses `pg` directly.

## Database tables

- `app_users`
- `news_sources`
- `news_articles`
- `news_insights`
- `payment_sessions`
- `telegram_invites`
- `access_grants`
- `delivery_events`

## Routes

- `/` - public landing page
- `/admin/catalog` - source and content ops
- `/admin/telegram` - Telegram channel aggregation and clustering ops
- `/admin/pricing` - payment and entitlement surface
- `/admin/forecast` - published insight feed

## API routes

- `GET /api/health`
- `GET /api/preview`
- `GET /api/access/:walletAddress`
- `POST /api/webhooks/x402`

If `telegramChannelId` is omitted from the webhook payload, the route falls back to `TELEGRAM_CHANNEL_ID`.

## Production note

The Telegram invite helper currently stores a placeholder link. Swap it with the Telegram bot API when you are ready to issue real join links.

Telegram aggregation planning and scaffolding notes live in [docs/telegram-aggregation.md](/Users/tayelroy/Documents/New project/docs/telegram-aggregation.md).
