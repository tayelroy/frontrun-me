import { NextResponse } from 'next/server';
import { z } from 'zod';
import { canTelegramUserAccessBot, redeemTelegramAccessCode } from '@/lib/access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const claimSchema = z.object({
  accessCode: z.string().min(1),
  telegramUserId: z.string().min(1),
  telegramHandle: z.string().optional()
});

const verifySchema = z.object({
  telegramUserId: z.string().min(1)
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = claimSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: 'accessCode and telegramUserId are required.' }, { status: 400 });
  }

  const result = await redeemTelegramAccessCode(parsed.data);
  if (!result.ok) {
    const status = result.reason === 'invalid_code' ? 404 : 409;
    return NextResponse.json({ ok: false, reason: result.reason }, { status });
  }

  return NextResponse.json({ ok: true, walletAddress: result.walletAddress });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = verifySchema.safeParse({
    telegramUserId: url.searchParams.get('telegramUserId')
  });

  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: 'telegramUserId is required.' }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    hasAccess: await canTelegramUserAccessBot(parsed.data.telegramUserId)
  });
}
