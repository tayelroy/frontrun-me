import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { withTransaction } from '../db';
import { upsertTelegramSource } from '../repository';

const sourceSchema = z
  .object({
    sourceName: z.string().min(1),
    telegramUsername: z.string().min(1).optional(),
    telegramChannelId: z.string().min(1).optional(),
    accessMode: z.enum(['bot', 'user_session', 'manual']).default('user_session'),
    tier: z.enum(['preview', 'premium', 'internal']).default('premium'),
    priority: z.number().int().min(0).max(100).default(50),
    category: z.enum(['exploit', 'regulation', 'partnership', 'macro', 'listing', 'fundraising', 'watchlist', 'defi', 'nft', 'gaming', 'ai', 'infra', 'other']).default('watchlist'),
    isActive: z.boolean().default(true)
  })
  .transform((source) => {
    const username = source.telegramUsername?.trim().replace(/^@/, '') || null;
    const telegramChannelId =
      source.telegramChannelId?.trim() ||
      (username ? `telegram:@${username.toLowerCase()}` : null);

    if (!telegramChannelId) {
      throw new Error(`Source "${source.sourceName}" must include telegramChannelId or telegramUsername.`);
    }

    return {
      ...source,
      telegramUsername: username,
      telegramChannelId
    };
  });

const sourceListSchema = z.array(sourceSchema);

export type TelegramRegistrySource = z.infer<typeof sourceSchema>;

export async function readTelegramSourceRegistry(filePath: string) {
  const raw = await readFile(filePath, 'utf8');
  const parsed = JSON.parse(raw) as unknown;
  return sourceListSchema.parse(parsed);
}

export async function syncTelegramSourceRegistry(sources: TelegramRegistrySource[]) {
  return withTransaction(async (db) => {
    const results = [];

    for (const source of sources) {
      const row = await upsertTelegramSource(db, source);
      results.push(row);
    }

    return results;
  });
}
