import { randomBytes } from 'node:crypto';
import { withTransaction } from './db';
import {
  claimTelegramBotAccessCode,
  createPaymentSession,
  getAccessByWallet,
  getTelegramBotAccessByCode,
  getTelegramBotAccessByTelegramUserId,
  grantAccess,
  markPaymentPaid,
  upsertTelegramBotAccessCode,
  upsertUser
} from './repository';

function makeAccessCode() {
  return `FRM-${randomBytes(4).toString('hex').toUpperCase()}`;
}

export async function recordPaymentAndIssueAccess(input: {
  walletAddress: string;
  chain: string;
  amount: string;
  currency: string;
  reference: string;
  transactionHash: string;
  telegramHandle?: string | null;
  telegramUserId?: string | null;
}) {
  return withTransaction(async (db) => {
    const user = await upsertUser(db, {
      walletAddress: input.walletAddress,
      telegramHandle: input.telegramHandle,
      telegramUserId: input.telegramUserId
    });

    const paymentSession = await createPaymentSession(db, {
      userId: user.id,
      walletAddress: input.walletAddress,
      chain: input.chain,
      amount: input.amount,
      currency: input.currency,
      reference: input.reference
    });

    const settledPayment = await markPaymentPaid(db, {
      reference: paymentSession.reference,
      transactionHash: input.transactionHash
    });

    const accessGrant = await grantAccess(db, {
      userId: user.id,
      paymentSessionId: settledPayment.id,
      telegramInviteId: null
    });

    const botAccess = await upsertTelegramBotAccessCode(db, {
      userId: user.id,
      accessCode: makeAccessCode()
    });

    return {
      user,
      paymentSession: settledPayment,
      accessGrant,
      botAccess
    };
  });
}

export async function hasAccess(walletAddress: string) {
  const access = await getAccessByWallet(walletAddress);
  if (!access?.grantedAt || access.revokedAt) {
    return false;
  }

  if (!access.expiresAt) {
    return true;
  }

  return new Date(access.expiresAt).getTime() > Date.now();
}

export async function redeemTelegramAccessCode(input: {
  accessCode: string;
  telegramUserId: string;
  telegramHandle?: string | null;
}) {
  const existing = await getTelegramBotAccessByCode(input.accessCode);
  if (!existing || existing.revokedAt) {
    return { ok: false, reason: 'invalid_code' as const };
  }

  const isGranted = !existing.grantedAt
    ? false
    : !existing.expiresAt || new Date(existing.expiresAt).getTime() > Date.now();

  if (!isGranted) {
    return { ok: false, reason: 'access_not_granted' as const };
  }

  if (existing.telegramUserId && existing.telegramUserId !== input.telegramUserId) {
    return { ok: false, reason: 'code_already_claimed' as const };
  }

  await withTransaction(async (db) => {
    await claimTelegramBotAccessCode(db, input);
    await upsertUser(db, {
      walletAddress: existing.walletAddress,
      telegramHandle: input.telegramHandle,
      telegramUserId: input.telegramUserId
    });
  });

  return {
    ok: true,
    walletAddress: existing.walletAddress
  };
}

export async function canTelegramUserAccessBot(telegramUserId: string) {
  const record = await getTelegramBotAccessByTelegramUserId(telegramUserId);
  if (!record || record.revokedAt || !record.grantedAt) {
    return false;
  }

  if (!record.expiresAt) {
    return true;
  }

  return new Date(record.expiresAt).getTime() > Date.now();
}
