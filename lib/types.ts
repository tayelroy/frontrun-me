export type SignalCategory =
  | 'exploit'
  | 'regulation'
  | 'partnership'
  | 'macro'
  | 'listing'
  | 'fundraising'
  | 'watchlist';

export type SignalBias = 'bullish' | 'bearish' | 'neutral' | 'urgent';

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
  revokedAt: string | null;
  grantedAt: string | null;
  expiresAt: string | null;
}
