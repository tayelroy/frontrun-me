import { NextResponse } from 'next/server';
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

  const record = await recordPaymentAndIssueAccess(parsed.data);

  return NextResponse.json(
    {
      ok: true,
      userId: record.user.id,
      inviteLink: null,
      paymentReference: record.paymentSession.reference,
      accessCode: record.botAccess.access_code
    },
    { status: 201 }
  );
}
