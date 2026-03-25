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
4. Run `npm run db:seed` if you want sample content immediately.
5. Run `npm run dev`.

The database scripts use a small Node runner in `scripts/run-sql.mjs`, so you do not need the `psql` CLI installed locally.

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
