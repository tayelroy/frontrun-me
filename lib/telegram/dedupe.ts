import { createHash } from 'node:crypto';
import type { SignalBias, SignalCategory } from '../types';

export interface TelegramClusterCandidate {
  normalizedText: string;
  extractedLinks: string[];
  corroborationCount?: number;
}

const categoryMatchers: Array<{ category: SignalCategory; keywords: string[] }> = [
  { category: 'exploit', keywords: ['exploit', 'hack', 'drain', 'treasury outflow'] },
  { category: 'regulation', keywords: ['sec', 'regulation', 'lawsuit', 'approval'] },
  { category: 'partnership', keywords: ['partnership', 'integration', 'distribution'] },
  { category: 'macro', keywords: ['etf', 'fed', 'macro', 'rate cut'] },
  { category: 'listing', keywords: ['listing', 'exchange listing'] },
  { category: 'fundraising', keywords: ['fundraise', 'raise', 'valuation'] }
];

export function inferTelegramCategory(normalizedText: string): SignalCategory {
  for (const matcher of categoryMatchers) {
    if (matcher.keywords.some((keyword) => normalizedText.includes(keyword))) {
      return matcher.category;
    }
  }

  return 'watchlist';
}

export function inferTelegramBias(normalizedText: string): SignalBias {
  if (normalizedText.includes('exploit') || normalizedText.includes('hack') || normalizedText.includes('lawsuit')) {
    return 'urgent';
  }
  if (normalizedText.includes('approval') || normalizedText.includes('inflow') || normalizedText.includes('partnership')) {
    return 'bullish';
  }
  if (normalizedText.includes('delay') || normalizedText.includes('outflow') || normalizedText.includes('risk')) {
    return 'bearish';
  }
  return 'neutral';
}

export function buildClusterFingerprint(candidate: TelegramClusterCandidate) {
  const anchor = candidate.extractedLinks[0] ?? candidate.normalizedText.split(' ').slice(0, 18).join(' ');
  return createHash('sha1').update(anchor).digest('hex');
}

export function scoreTelegramCandidate(candidate: TelegramClusterCandidate) {
  let score = 48;
  if (candidate.extractedLinks.length > 0) score += 12;
  if (candidate.normalizedText.includes('urgent') || candidate.normalizedText.includes('exploit')) score += 20;
  score += Math.min((candidate.corroborationCount ?? 1) * 8, 24);
  return Math.min(score, 99);
}
