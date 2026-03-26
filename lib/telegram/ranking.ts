import type { SignalBias, TelegramClusterPreview } from '../types';

export function getTelegramUrgencyRank(bias: SignalBias) {
  switch (bias) {
    case 'urgent':
      return 3;
    case 'bullish':
    case 'bearish':
      return 2;
    default:
      return 1;
  }
}

export function getTelegramWeightRank(item: TelegramClusterPreview) {
  return Math.round(item.signalScore) + item.corroborationCount * 8;
}

export function rankTelegramDigestItems(items: TelegramClusterPreview[]) {
  return [...items].sort((a, b) => {
    const recencyDelta = Date.parse(b.postedAt) - Date.parse(a.postedAt);
    if (recencyDelta !== 0) return recencyDelta;

    const urgencyDelta = getTelegramUrgencyRank(b.bias) - getTelegramUrgencyRank(a.bias);
    if (urgencyDelta !== 0) return urgencyDelta;

    const weightDelta = getTelegramWeightRank(b) - getTelegramWeightRank(a);
    if (weightDelta !== 0) return weightDelta;

    const sourceDelta = a.sourceName.localeCompare(b.sourceName);
    if (sourceDelta !== 0) return sourceDelta;

    return a.id.localeCompare(b.id);
  });
}

export function limitTelegramDigestItems(items: TelegramClusterPreview[], limit: number) {
  return rankTelegramDigestItems(items).slice(0, limit);
}

export function trimTelegramDigestText(input: string | null | undefined, maxLength: number) {
  const text = input?.replace(/\s+/g, ' ').trim() ?? '';
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

export function formatTelegramDigestTimestamp(isoTimestamp: string) {
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) {
    return isoTimestamp;
  }

  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date).replace(',', '');
}
