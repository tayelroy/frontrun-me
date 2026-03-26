import { z } from 'zod';
import { env } from '../env';
import { callPicoclawChatCompletion, isPicoclawConfigured } from '../picoclaw/client';
import type { TelegramClusterPreview } from '../types';
import {
  formatTelegramDigestTimestamp,
  limitTelegramDigestItems,
  trimTelegramDigestText
} from './ranking';

const digestSummarySchema = z.object({
  title: z.string().min(1).max(120),
  intro: z.string().min(1).max(300),
  bullets: z
    .array(
      z.object({
        takeaway: z.string().min(1).max(220),
        whyItMatters: z.string().min(1).max(220)
      })
    )
    .min(1)
    .max(6),
  closing: z.string().min(1).max(220).optional()
});

export interface TelegramDigestAiResult {
  title: string;
  intro: string;
  items: Array<
    TelegramClusterPreview & {
      takeaway: string;
      whyItMatters: string;
    }
  >;
  closing?: string;
}

function buildDigestPromptItems(items: TelegramClusterPreview[]) {
  return items.map((item, index) => ({
    rank: index + 1,
    sourceName: item.sourceName,
    category: item.category,
    bias: item.bias,
    signalScore: Math.round(item.signalScore),
    corroborationCount: item.corroborationCount,
    postedAt: formatTelegramDigestTimestamp(item.postedAt),
    summary: trimTelegramDigestText(item.summary, 180),
    whyItMatters: trimTelegramDigestText(item.whyItMatters, 180)
  }));
}

function extractJsonPayload(content: string) {
  const trimmed = content.trim();

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return trimmed;
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  throw new Error('Picoclaw response did not include JSON.');
}

export async function summarizeTelegramDigestWithPicoclaw(items: TelegramClusterPreview[]) {
  if (!isPicoclawConfigured()) {
    return null;
  }

  const selectedItems = limitTelegramDigestItems(items, env.TELEGRAM_DIGEST_CONTEXT_LIMIT);
  if (selectedItems.length === 0) {
    return null;
  }

  const promptItems = buildDigestPromptItems(selectedItems);

  const content = await callPicoclawChatCompletion({
    maxTokens: 700,
    temperature: 0.2,
    messages: [
      {
        role: 'system',
        content:
          'You are the FrontRunMe digest editor. Summarize Telegram crypto signal clusters into a concise private briefing. Preserve the input order exactly. Keep the context window small. Prioritize recency first, then urgency, then weightage, but do not reorder the items because the input is already ranked. Use only the provided data. Write for Telegram readability: short sentences, no fluff, no emojis, no markdown tables, and no image references. Return strict JSON with keys title, intro, bullets, and closing. bullets must contain one object per input item, in the same order, with keys takeaway and whyItMatters.'
      },
      {
        role: 'user',
        content: JSON.stringify(
          {
            sort_order: ['recency_desc', 'urgency_desc', 'weight_desc'],
            items: promptItems
          },
          null,
          2
        )
      }
    ]
  });

  const parsed = digestSummarySchema.safeParse(JSON.parse(extractJsonPayload(content)));
  if (!parsed.success) {
    throw new Error(`Picoclaw digest response failed validation: ${parsed.error.message}`);
  }

  if (parsed.data.bullets.length !== selectedItems.length) {
    throw new Error('Picoclaw returned a different number of bullets than requested.');
  }

  return {
    items: selectedItems.map((item, index) => ({
      ...item,
      takeaway: parsed.data.bullets[index].takeaway,
      whyItMatters: parsed.data.bullets[index].whyItMatters
    })),
    ...parsed.data
  } satisfies TelegramDigestAiResult;
}

export type TelegramDigestAiSummary = Awaited<ReturnType<typeof summarizeTelegramDigestWithPicoclaw>>;
