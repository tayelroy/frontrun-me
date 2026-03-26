# Telegram Aggregation Implementation Plan

This repo now includes the storage and server-side scaffolding for Telegram channel aggregation.

## Core flow

1. Register channels in `telegram_sources`
2. Record each worker pass in `telegram_ingestion_runs`
3. Persist raw normalized posts in `telegram_messages`
4. Group related chatter into `telegram_signal_clusters`
5. Verify each cluster via Twitter links and onchain transactions (OKX Onchain OS)
6. Treat unsent clusters as the "new information pool"
7. Attach supporting posts in `telegram_cluster_messages`
8. Send a digest and mark delivered clusters as the "old information pool"
9. Promote reviewed clusters into `news_articles` and `news_insights`

## Code touchpoints

- `src/db/schema.sql`
- `src/db/seed.sql`
- `lib/repository.ts`
- `lib/telegram/source-registry.ts`
- `lib/telegram/normalize.ts`
- `lib/telegram/dedupe.ts`
- `lib/telegram/pipeline.ts`
- `lib/onchainos/news-verification.ts`
- `scripts/telegram-sync-sources.ts`
- `config/telegram-sources.example.json`
- `app/admin/telegram/page.tsx`

## Operating the registry

1. Copy `config/telegram-sources.example.json` to `config/telegram-sources.json`
2. Add the public usernames or channel ids you want to monitor
3. Run `npm run telegram:sources`
4. Run `npm run telegram:ingest`
5. Run `npm run telegram:promote`
6. Run `npm run telegram:digest`
7. Run `npm run telegram:brief` when you want the full ingest-to-brief flow in one command and the final message echoed to the terminal.

If a channel has a public username, you can omit the numeric channel id. The sync script will generate a stable synthetic id and the worker will resolve the entity by username first.

The digest AI pass uses Picoclaw on your VM through SSH. The prompt only includes the most recent `TELEGRAM_DIGEST_CONTEXT_LIMIT` clusters, sorted by recency first, then urgency, then weightage, so the context window stays small.

Run `npm run picoclaw:check` to verify the SSH path with a small probe before sending a full digest.

## Suggested next milestone

Build a worker that:

- fetches new Telegram messages per source
- runs `normalizeTelegramMessage`
- inserts raw messages with `insertTelegramMessage`
- fingerprints related posts
- upserts a cluster with `upsertTelegramCluster`
- links messages with `attachTelegramMessageToCluster`

## Rollout notes

- Prefer channels you are explicitly allowed to ingest.
- Start with manual review before automatic premium publishing.
- Keep the promotion step separate from raw aggregation so you can tune dedupe and scoring safely.
- If the Picoclaw SSH command is unavailable, the digest step falls back to the deterministic formatter and still sends.
