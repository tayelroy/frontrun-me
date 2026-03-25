import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { recordPaymentAndIssueAccess } from '@/lib/access';
import { x402Schema } from '@/lib/x402';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ ok: false, message: 'Invalid JSON payload.' }, { status: 400 });
  }

  const parsed = x402Schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ ok: false, errors: parsed.error.flatten() }, { status: 400 });
  }

  const telegramChannelId = parsed.data.telegramChannelId ?? env.TELEGRAM_CHANNEL_ID;
  if (!telegramChannelId) {
    return NextResponse.json(
      { ok: false, message: 'telegramChannelId is required in the request or as TELEGRAM_CHANNEL_ID.' },
      { status: 400 }
    );
  }

  const record = await recordPaymentAndIssueAccess({
    ...parsed.data,
    telegramChannelId
  });

  return NextResponse.json(
    {
      ok: true,
      userId: record.user.id,
      inviteLink: record.telegramInvite.invite_link,
      paymentReference: record.paymentSession.reference
    },
    { status: 201 }
  );
}
