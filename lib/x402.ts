import { z } from 'zod';

export const x402Schema = z.object({
  walletAddress: z.string().min(1),
  chain: z.string().min(1).default('base'),
  amount: z.string().min(1),
  currency: z.string().min(1).default('USDC'),
  reference: z.string().min(1),
  transactionHash: z.string().min(1),
  telegramChannelId: z.string().min(1).optional(),
  telegramHandle: z.string().optional(),
  telegramUserId: z.string().optional()
});
