import { NextResponse } from 'next/server';
import { listPublishedInsights } from '@/lib/repository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const fallbackItems = [
  {
    id: 'fallback-1',
    title: 'ETH ETF chatter returns',
    category: 'macro',
    bias: 'bullish',
    summary: 'Fresh headlines are pulling attention back toward ETH ecosystem assets.',
    whyItMatters: 'Narrative rotation can create short bursts of liquidity and momentum.',
    score: 88
  },
  {
    id: 'fallback-2',
    title: 'Exchange exploit rumor spreads',
    category: 'exploit',
    bias: 'bearish',
    summary: 'Reports suggest a possible exploit surface is being investigated by multiple sources.',
    whyItMatters: 'Security headlines typically trigger volatility and fast risk-off positioning.',
    score: 95
  },
  {
    id: 'fallback-3',
    title: 'New chain partnership announced',
    category: 'partnership',
    bias: 'neutral',
    summary: 'A protocol partnership may expand distribution, but the market is still waiting on usage data.',
    whyItMatters: 'High-signal summaries separate marketing noise from actual catalysts.',
    score: 72
  }
];

export async function GET() {
  const items = await listPublishedInsights(6);
  return NextResponse.json({ items: items.length > 0 ? items : fallbackItems });
}
