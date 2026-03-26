import type { PoolClient } from 'pg';
import type { TelegramClient } from 'telegram';
import { query, withTransaction } from '../db';
import { env } from '../env';
import type { TelegramRawMessage } from './normalize';
import { normalizeTelegramMessage } from './normalize';
import { buildClusterFingerprint, scoreTelegramCandidate } from './dedupe';
import { buildTelegramClusterDraft } from './pipeline';
import {
  attachTelegramMessageToCluster,
  createTelegramIngestionRun,
  finalizeTelegramIngestionRun,
  listActiveTelegramSources,
  persistTelegramMessage,
  updateTelegramSourceCursor,
  upsertTelegramCluster
} from './db';

type Db = Pick<PoolClient, 'query'>;

export interface TelegramIngestionOptions {
  sourceFilter?: string[];
}

export interface TelegramSourceIngestionResult {
  sourceId: string;
  sourceName: string;
  fetchedCount: number;
  insertedCount: number;
  dedupedCount: number;
  clusterCount: number;
  status: 'completed' | 'failed';
  errorMessage?: string;
}

interface TelegramMessageBatchItem {
  raw: TelegramRawMessage & { groupedId?: number | null; replyToMessageId?: number | null };
  normalized: ReturnType<typeof normalizeTelegramMessage>;
  isContentful: boolean;
  score: number;
}

interface TelegramClusterBatch {
  canonicalNormalized: ReturnType<typeof normalizeTelegramMessage>;
  messageIds: string[];
}

function toIsoDate(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'number') {
    return new Date(value * 1000).toISOString();
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return new Date().toISOString();
}

function getTelegramMessageText(message: any) {
  return typeof message?.message === 'string' ? message.message : typeof message?.text === 'string' ? message.text : '';
}

function getTelegramMediaKind(message: any) {
  const media = message?.media;
  const className = media?.className ?? media?.constructor?.name ?? '';

  if (typeof className !== 'string' || !className) {
    return null;
  }

  if (className.includes('Photo')) return 'photo';
  if (className.includes('Document')) return 'document';
  if (className.includes('WebPage')) return 'link';
  if (className.includes('Poll')) return 'poll';
  if (className.includes('Voice')) return 'voice';
  if (className.includes('Video')) return 'video';
  if (className.includes('Audio')) return 'audio';

  return className.replace(/^MessageMedia/, '').toLowerCase() || null;
}

function getTelegramForwardedFrom(message: any) {
  const forwarded = message?.fwdFrom;

  if (!forwarded) {
    return null;
  }

  if (typeof forwarded.fromName === 'string' && forwarded.fromName.trim()) {
    return forwarded.fromName.trim();
  }

  if (forwarded.channelId != null) {
    return `channel:${forwarded.channelId}`;
  }

  if (forwarded.fromId != null) {
    return `user:${forwarded.fromId}`;
  }

  return 'forwarded';
}

function getTelegramSenderName(message: any, sourceName: string, entity: any) {
  const postAuthor = typeof message?.postAuthor === 'string' ? message.postAuthor.trim() : '';
  if (postAuthor) {
    return postAuthor;
  }

  const entityTitle = typeof entity?.title === 'string' ? entity.title.trim() : '';
  if (entityTitle) {
    return entityTitle;
  }

  return sourceName;
}

function getMessageDateMs(message: any) {
  if (message?.date instanceof Date) {
    return message.date.getTime();
  }

  if (typeof message?.date === 'number') {
    return message.date * 1000;
  }

  const parsed = Date.parse(message?.date ?? '');
  return Number.isNaN(parsed) ? Date.now() : parsed;
}

function buildSafeTelegramPayload(message: any, entity: any) {
  return {
    id: message?.id ?? null,
    className: message?.className ?? message?.constructor?.name ?? 'Message',
    date: message?.date instanceof Date ? message.date.toISOString() : message?.date ?? null,
    groupedId: message?.groupedId != null ? String(message.groupedId) : null,
    post: Boolean(message?.post),
    postAuthor: message?.postAuthor ?? null,
    views: message?.views ?? null,
    forwards: message?.forwards ?? null,
    editDate: message?.editDate instanceof Date ? message.editDate.toISOString() : message?.editDate ?? null,
    replyToMsgId: message?.replyTo?.replyToMsgId ?? null,
    senderId: message?.senderId != null ? String(message.senderId) : null,
    entityId: entity?.id != null ? String(entity.id) : null,
    entityUsername: entity?.username ?? null,
    entityTitle: entity?.title ?? null
  };
}

async function resolveTelegramEntity(
  client: TelegramClient,
  source: { telegramUsername: string | null; telegramChannelId: string; sourceName: string }
) {
  const candidates = [source.telegramUsername?.replace(/^@/, ''), source.telegramChannelId.replace(/^telegram:/, ''), source.telegramChannelId];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    try {
      return await client.getEntity(candidate as any);
    } catch {
      // Try the next identifier.
    }
  }

  throw new Error(
    `Unable to resolve Telegram source "${source.sourceName}". Add a public username or make sure the authenticated account can access the channel.`
  );
}

async function collectTelegramMessages(
  client: TelegramClient,
  source: { id: string; sourceName: string; telegramUsername: string | null; telegramChannelId: string; lastProcessedMessageId: string | null }
) {
  const entity = await resolveTelegramEntity(client, source);
  const minId = source.lastProcessedMessageId ? Number(source.lastProcessedMessageId) : 0;
  const limit = source.lastProcessedMessageId ? env.TELEGRAM_INGEST_LIMIT : Math.min(env.TELEGRAM_INGEST_LIMIT, 25);
  const cutoffMs = Date.now() - env.TELEGRAM_INGEST_LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
  const collected: TelegramMessageBatchItem[] = [];

  for await (const message of client.iterMessages(entity, { minId, limit, waitTime: env.TELEGRAM_INGEST_WAIT_TIME })) {
    if (!message || typeof message.id !== 'number') {
      continue;
    }

    const messageDateMs = getMessageDateMs(message);
    if (messageDateMs < cutoffMs) {
      break;
    }

    const text = getTelegramMessageText(message);
    const mediaKind = getTelegramMediaKind(message);
    const raw: TelegramRawMessage & { groupedId?: number | null; replyToMessageId?: number | null } = {
      sourceId: source.id,
      telegramMessageId: message.id,
      postedAt: toIsoDate(message.date),
      text: text || null,
      senderName: getTelegramSenderName(message, source.sourceName, entity),
      forwardedFrom: getTelegramForwardedFrom(message),
      mediaKind,
      groupedId: message.groupedId != null ? Number(message.groupedId) : null,
      replyToMessageId: message.replyTo?.replyToMsgId != null ? Number(message.replyTo.replyToMsgId) : null,
      rawPayload: buildSafeTelegramPayload(message, entity)
    };

    const normalized = normalizeTelegramMessage(raw);
    const score = scoreTelegramCandidate({
      normalizedText: normalized.normalizedText,
      extractedLinks: normalized.extractedLinks,
      corroborationCount: 1
    });

    const isContentful = normalized.normalizedText.length > 0 || normalized.extractedLinks.length > 0;

    collected.push({
      raw,
      normalized,
      isContentful,
      score
    });
  }

  return collected;
}

function buildClusterBatches(messages: TelegramMessageBatchItem[]) {
  const batches = new Map<string, TelegramClusterBatch>();

  for (const item of messages) {
    if (!item.isContentful) {
      continue;
    }

    const fingerprint = buildClusterFingerprint({
      normalizedText: item.normalized.normalizedText,
      extractedLinks: item.normalized.extractedLinks
    });

    const existing = batches.get(fingerprint);
    if (existing) {
      existing.messageIds.push(item.normalized.telegramMessageId.toString());
      continue;
    }

    batches.set(fingerprint, {
      canonicalNormalized: item.normalized,
      messageIds: [item.normalized.telegramMessageId.toString()]
    });
  }

  return batches;
}

export async function ingestTelegramSources(
  client: TelegramClient,
  options: TelegramIngestionOptions = {}
): Promise<TelegramSourceIngestionResult[]> {
  const sources = await listActiveTelegramSources();
  const globalDb = { query } as Db;
  const filteredSources =
    options.sourceFilter && options.sourceFilter.length > 0
      ? sources.filter((source) => {
          const candidates = [source.id, source.sourceName, source.telegramUsername ?? '', source.telegramChannelId]
            .filter(Boolean)
            .map((value) => value.toLowerCase());

          return options.sourceFilter!.some((needle) => candidates.some((candidate) => candidate.includes(needle.toLowerCase())));
        })
      : sources;

  const results: TelegramSourceIngestionResult[] = [];

  for (const source of filteredSources) {
    console.log(`Ingesting ${source.sourceName} (@${source.telegramUsername ?? source.telegramChannelId})...`);
    const run = await createTelegramIngestionRun(globalDb, {
      sourceId: source.id,
      startedAt: new Date().toISOString()
    });

    try {
      const messages = await collectTelegramMessages(client, source);
      const clusterBatches = buildClusterBatches(messages);
      const sourceResult = await withTransaction<TelegramSourceIngestionResult>(async (tx) => {
        let insertedCount = 0;
        let dedupedCount = 0;
        let clusterCount = 0;
        const persistedMessages = new Map<string, { id: string; normalized: ReturnType<typeof normalizeTelegramMessage> }>();

        for (const item of messages) {
          const persisted = await persistTelegramMessage(tx, {
            sourceId: source.id,
            telegramMessageId: item.raw.telegramMessageId,
            groupedId: item.raw.groupedId ?? null,
            postedAt: item.raw.postedAt,
            senderName: item.raw.senderName ?? null,
            messageText: item.raw.text ?? null,
            normalizedText: item.normalized.normalizedText,
            contentHash: item.normalized.contentHash,
            dedupeKey: item.normalized.dedupeKey,
            mediaKind: item.normalized.mediaKind,
            forwardedFrom: item.normalized.forwardedFrom,
            replyToMessageId: item.raw.replyToMessageId ?? null,
            rawPayload: item.normalized.rawPayload,
            extractedLinks: item.normalized.extractedLinks,
            tags: item.normalized.tags,
            isCandidate: item.isContentful && item.score >= 60
          });

          insertedCount += 1;
          persistedMessages.set(item.normalized.telegramMessageId.toString(), {
            id: persisted.id,
            normalized: item.normalized
          });
        }

        for (const [fingerprint, clusterBatch] of clusterBatches) {
          const canonicalKey = clusterBatch.messageIds[0];
          const canonicalPersisted = persistedMessages.get(canonicalKey);

          if (!canonicalPersisted) {
            continue;
          }

          const draft = buildTelegramClusterDraft({
            normalizedText: clusterBatch.canonicalNormalized.normalizedText,
            extractedLinks: clusterBatch.canonicalNormalized.extractedLinks,
            corroborationCount: clusterBatch.messageIds.length
          });

          const cluster = await upsertTelegramCluster(tx, {
            canonicalMessageId: canonicalPersisted.id,
            clusterFingerprint: fingerprint,
            category: draft.category,
            bias: draft.bias,
            signalScore: draft.signalScore,
            corroborationCount: clusterBatch.messageIds.length,
            status: clusterBatch.messageIds.length > 1 || draft.signalScore >= 70 ? 'reviewed' : 'queued',
            summary: draft.summary,
            whyItMatters: draft.whyItMatters
          });

          clusterCount += 1;
          dedupedCount += Math.max(clusterBatch.messageIds.length - 1, 0);

          for (let index = 0; index < clusterBatch.messageIds.length; index += 1) {
            const messageId = clusterBatch.messageIds[index];
            const persisted = persistedMessages.get(messageId);

            if (!persisted) {
              continue;
            }

            await attachTelegramMessageToCluster(tx, {
              clusterId: cluster.id,
              messageId: persisted.id,
              isCanonical: index === 0
            });
          }
        }

        const latestMessageId = messages.reduce((max, item) => Math.max(max, item.raw.telegramMessageId), Number(source.lastProcessedMessageId ?? 0));
        const latestSeenAt = messages.length > 0 ? messages[messages.length - 1].raw.postedAt : new Date().toISOString();

        await updateTelegramSourceCursor(tx, {
          sourceId: source.id,
          lastProcessedMessageId: messages.length > 0 ? latestMessageId : null,
          lastSeenAt: latestSeenAt
        });

        return {
          sourceId: source.id,
          sourceName: source.sourceName,
          fetchedCount: messages.length,
          insertedCount,
          dedupedCount,
          clusterCount,
          status: 'completed'
        };
      });

      results.push(sourceResult);
      console.log(
        `Completed ${source.sourceName}: fetched=${sourceResult.fetchedCount} inserted=${sourceResult.insertedCount} deduped=${sourceResult.dedupedCount} clusters=${sourceResult.clusterCount}`
      );
      await finalizeTelegramIngestionRun(globalDb, {
        runId: run.id,
        status: 'completed',
        completedAt: new Date().toISOString(),
        fetchedCount: sourceResult.fetchedCount,
        insertedCount: sourceResult.insertedCount,
        dedupedCount: sourceResult.dedupedCount
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Failed ${source.sourceName}: ${errorMessage}`);

      await finalizeTelegramIngestionRun(globalDb, {
        runId: run.id,
        status: 'failed',
        completedAt: new Date().toISOString(),
        errorMessage
      }).catch(() => null);

      results.push({
        sourceId: source.id,
        sourceName: source.sourceName,
        fetchedCount: 0,
        insertedCount: 0,
        dedupedCount: 0,
        clusterCount: 0,
        status: 'failed',
        errorMessage
      });
    }
  }

  return results;
}
