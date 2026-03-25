import 'server-only';
import { randomBytes } from 'node:crypto';
import { withTransaction } from './db';
import { createPaymentSession, createTelegramInvite, grantAccess, markPaymentPaid, upsertUser } from './repository';

function makeInviteToken(reference: string) {
  return `${reference.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10)}-${randomBytes(4).toString('hex')}`;
}

function makeInviteLink(token: string) {
  // Replace this placeholder with a Telegram bot API invite when you wire up production invites.
  return `https://t.me/+${token}`;
}

export async function recordPaymentAndIssueAccess(input: {
  walletAddress: string;
  chain: string;
  amount: string;
  currency: string;
  reference: string;
  transactionHash: string;
  telegramChannelId: string;
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

    const inviteToken = makeInviteToken(input.reference);
    const telegramInvite = await createTelegramInvite(db, {
      userId: user.id,
      channelId: input.telegramChannelId,
      inviteLink: makeInviteLink(inviteToken),
      inviteToken
    });

    const accessGrant = await grantAccess(db, {
      userId: user.id,
      paymentSessionId: settledPayment.id,
      telegramInviteId: telegramInvite.id
    });

    return {
      user,
      paymentSession: settledPayment,
      telegramInvite,
      accessGrant
    };
  });
}
