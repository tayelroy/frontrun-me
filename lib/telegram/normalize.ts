import { createHash } from 'node:crypto';

export interface TelegramRawMessage {
  sourceId: string;
  telegramMessageId: number;
  postedAt: string;
  text?: string | null;
  senderName?: string | null;
  forwardedFrom?: string | null;
  mediaKind?: string | null;
  rawPayload?: Record<string, unknown>;
}

export interface NormalizedTelegramMessage {
  sourceId: string;
  telegramMessageId: number;
  postedAt: string;
  senderName: string | null;
  messageText: string | null;
  normalizedText: string;
  contentHash: string;
  dedupeKey: string;
  mediaKind: string | null;
  forwardedFrom: string | null;
  extractedLinks: string[];
  tags: string[];
  rawPayload: Record<string, unknown>;
}

const urlPattern = /\bhttps?:\/\/[^\s)]+/gi;

export function normalizeTelegramText(value: string | null | undefined) {
  return (value ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s:/.-]+/g, ' ')
    .trim();
}

export function extractTelegramLinks(value: string | null | undefined) {
  return Array.from(new Set((value ?? '').match(urlPattern) ?? []));
}

function hashValue(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

export function buildTelegramDedupeKey(normalizedText: string, extractedLinks: string[]) {
  const primaryLink = extractedLinks[0] ?? '';
  const fingerprint = `${normalizedText}|${primaryLink}`;
  return hashValue(fingerprint);
}

export function deriveTelegramTags(normalizedText: string) {
  const tags = new Set<string>();

  if (normalizedText.includes('exploit') || normalizedText.includes('hack')) tags.add('security');
  if (normalizedText.includes('etf')) tags.add('etf');
  if (normalizedText.includes('partnership')) tags.add('partnership');
  if (normalizedText.includes('listing')) tags.add('listing');
  if (normalizedText.includes('regulation')) tags.add('regulation');

  return Array.from(tags);
}

export function normalizeTelegramMessage(input: TelegramRawMessage): NormalizedTelegramMessage {
  const normalizedText = normalizeTelegramText(input.text);
  const extractedLinks = extractTelegramLinks(input.text);

  return {
    sourceId: input.sourceId,
    telegramMessageId: input.telegramMessageId,
    postedAt: input.postedAt,
    senderName: input.senderName ?? null,
    messageText: input.text ?? null,
    normalizedText,
    contentHash: hashValue(normalizedText),
    dedupeKey: buildTelegramDedupeKey(normalizedText, extractedLinks),
    mediaKind: input.mediaKind ?? null,
    forwardedFrom: input.forwardedFrom ?? null,
    extractedLinks,
    tags: deriveTelegramTags(normalizedText),
    rawPayload: input.rawPayload ?? {}
  };
}
