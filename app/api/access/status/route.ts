import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hasAccess } from '@/lib/access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const querySchema = z.object({
  walletAddress: z.string().min(1)
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    walletAddress: url.searchParams.get('walletAddress')
  });

  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: 'walletAddress is required.' }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    hasAccess: await hasAccess(parsed.data.walletAddress)
  });
}
