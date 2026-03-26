import type { TelegramPipelineStep } from '../types';
import { inferTelegramBias, inferTelegramCategory, scoreTelegramCandidate } from './dedupe';

export const telegramPipelineSteps: TelegramPipelineStep[] = [
  {
    id: 'registry',
    title: 'Source registry',
    status: 'ready',
    detail: 'Track channel ids, access mode, priority, and cursor position in `telegram_sources`.',
    output: 'Reliable per-channel checkpointing.'
  },
  {
    id: 'ingestion',
    title: 'Incremental ingestion worker',
    status: 'ready',
    detail: 'Poll active channels, persist raw payloads, and append `telegram_ingestion_runs` rows.',
    output: 'Raw Telegram message history with replay safety.'
  },
  {
    id: 'normalize',
    title: 'Normalization and link extraction',
    status: 'ready',
    detail: 'Standardize text, compute content hashes, and capture canonical links before scoring.',
    output: 'Comparable records for dedupe and downstream AI.'
  },
  {
    id: 'cluster',
    title: 'Cluster and corroborate',
    status: 'next',
    detail: 'Group related posts into `telegram_signal_clusters` using fingerprints and timing windows.',
    output: 'One signal object instead of repetitive channel chatter.'
  },
  {
    id: 'promotion',
    title: 'Promote to news insight',
    status: 'next',
    detail: 'Turn reviewed clusters into `news_articles` and `news_insights` for premium delivery.',
    output: 'Telegram discoveries appear on the landing page and premium channel.'
  },
  {
    id: 'publish',
    title: 'Automated Telegram publishing',
    status: 'later',
    detail: 'Publish reviewed insights to premium Telegram and record delivery events.',
    output: 'Closed-loop discovery to distribution pipeline.'
  }
];

export function buildTelegramClusterDraft(input: {
  normalizedText: string;
  extractedLinks: string[];
  corroborationCount?: number;
  verificationScoreBoost?: number;
  verificationSummary?: string | null;
}) {
  const baselineScore = scoreTelegramCandidate(input);
  const verificationScoreBoost = Math.max(0, Math.min(input.verificationScoreBoost ?? 0, 24));

  return {
    category: inferTelegramCategory(input.normalizedText),
    bias: inferTelegramBias(input.normalizedText),
    signalScore: Math.min(99, baselineScore + verificationScoreBoost),
    summary: input.normalizedText.slice(0, 240),
    whyItMatters: input.verificationSummary
      ? `Telegram-first signals often surface before broader crypto media distribution. ${input.verificationSummary}`
      : 'Telegram-first signals often surface before broader crypto media distribution.'
  };
}
