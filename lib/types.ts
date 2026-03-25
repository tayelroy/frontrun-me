export type SignalCategory =
  | 'exploit'
  | 'regulation'
  | 'partnership'
  | 'macro'
  | 'listing'
  | 'fundraising'
  | 'watchlist';

export type SignalBias = 'bullish' | 'bearish' | 'neutral' | 'urgent';
export type TelegramAccessMode = 'bot' | 'user_session' | 'manual';
export type TelegramSourceTier = 'preview' | 'premium' | 'internal';
export type TelegramRunStatus = 'running' | 'completed' | 'failed';
export type TelegramClusterStatus = 'queued' | 'reviewed' | 'promoted' | 'published' | 'discarded';

export interface PreviewInsight {
  id: string;
  title: string;
  category: SignalCategory;
  bias: SignalBias;
  summary: string;
  whyItMatters: string;
  score: number;
}

export interface AccessSnapshot {
  userId: string;
  walletAddress: string;
  telegramHandle: string | null;
  paymentReference: string | null;
  paymentStatus: string | null;
  inviteLink: string | null;
  channelId: string | null;
  accessCode: string | null;
  linkedTelegramUserId: string | null;
  accessCodeClaimedAt: string | null;
  revokedAt: string | null;
  grantedAt: string | null;
  expiresAt: string | null;
}

export interface AccessStatusResponse {
  hasAccess: boolean;
}

export interface TelegramAggregationOverview {
  sources: number;
  activeSources: number;
  rawMessages: number;
  candidateMessages: number;
  clusters: number;
  promotedClusters: number;
  completedRuns: number;
  failedRuns: number;
}

export interface TelegramSourceStatus {
  id: string;
  sourceName: string;
  telegramChannelId: string;
  telegramUsername: string | null;
  accessMode: TelegramAccessMode;
  tier: TelegramSourceTier;
  priority: number;
  category: SignalCategory;
  isActive: boolean;
  lastProcessedMessageId: string | null;
  lastSeenAt: string | null;
  lastRunStatus: TelegramRunStatus | null;
  lastRunCompletedAt: string | null;
  fetchedCount: number;
  insertedCount: number;
  dedupedCount: number;
}

export interface TelegramSourceConfig {
  id: string;
  sourceName: string;
  telegramChannelId: string;
  telegramUsername: string | null;
  accessMode: TelegramAccessMode;
  tier: TelegramSourceTier;
  priority: number;
  category: SignalCategory;
  lastProcessedMessageId: string | null;
  lastSeenAt: string | null;
}

export interface TelegramClusterPreview {
  id: string;
  sourceName: string;
  category: SignalCategory;
  bias: SignalBias;
  signalScore: number;
  corroborationCount: number;
  status: TelegramClusterStatus;
  summary: string | null;
  whyItMatters: string | null;
  postedAt: string;
}

export interface TelegramPipelineStep {
  id: string;
  title: string;
  status: 'ready' | 'next' | 'later';
  detail: string;
  output: string;
}
