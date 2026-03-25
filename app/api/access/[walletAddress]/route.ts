import { NextResponse } from 'next/server';
import { getAccessByWallet } from '@/lib/repository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ walletAddress: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { walletAddress } = await params;
  const access = await getAccessByWallet(walletAddress);

  if (!access) {
    return NextResponse.json({ ok: false, message: 'No access record found for that wallet.' }, { status: 404 });
  }

  return NextResponse.json({ ok: true, access });
}
