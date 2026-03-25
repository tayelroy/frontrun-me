import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { env } from '@/lib/env';

export const runtime = 'nodejs';

const prepareSchema = z.object({
  walletAddress: z.string().min(1)
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = prepareSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: 'walletAddress is required.' }, { status: 400 });
  }

  if (!env.X402_PAYMENT_RECIPIENT) {
    return NextResponse.json(
      { ok: false, message: 'X402_PAYMENT_RECIPIENT is not configured yet.' },
      { status: 503 }
    );
  }

  const needsTokenContract = env.X402_PRICE_CURRENCY.toUpperCase() !== 'ETH';
  if (needsTokenContract && !env.X402_PAYMENT_ASSET_ADDRESS) {
    return NextResponse.json(
      { ok: false, message: 'X402_PAYMENT_ASSET_ADDRESS is required for token-based checkout.' },
      { status: 503 }
    );
  }

  return NextResponse.json({
    ok: true,
    checkout: {
      reference: `x402_${randomUUID()}`,
      walletAddress: parsed.data.walletAddress.toLowerCase(),
      chain: env.X402_CHAIN,
      chainId: env.X402_CHAIN_ID,
      amount: env.X402_PRICE_AMOUNT,
      currency: env.X402_PRICE_CURRENCY,
      recipientAddress: env.X402_PAYMENT_RECIPIENT,
      assetAddress: env.X402_PAYMENT_ASSET_ADDRESS ?? null,
      assetDecimals: env.X402_PAYMENT_ASSET_DECIMALS,
      resource: 'frontrunme://premium-access',
      description: 'FrontRunMe premium channel access'
    }
  });
}
