import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1).optional(),
  TELEGRAM_CHANNEL_ID: z.string().optional(),
  TELEGRAM_API_ID: z.coerce.number().int().positive().optional(),
  TELEGRAM_API_HASH: z.string().min(1).optional(),
  TELEGRAM_SESSION: z.string().optional(),
  TELEGRAM_PHONE_NUMBER: z.string().optional(),
  TELEGRAM_2FA_PASSWORD: z.string().optional(),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  X402_WEBHOOK_SECRET: z.string().optional(),
  X402_CHAIN: z.string().default('base'),
  X402_CHAIN_ID: z.string().default('8453'),
  X402_PRICE_AMOUNT: z.string().default('299'),
  X402_PRICE_CURRENCY: z.string().default('USDC'),
  X402_PAYMENT_RECIPIENT: z.string().optional(),
  X402_PAYMENT_ASSET_ADDRESS: z.string().optional(),
  X402_PAYMENT_ASSET_DECIMALS: z.coerce.number().int().positive().default(6),
  PORT: z.coerce.number().int().positive().default(3000)
});

export const env = envSchema.parse(process.env);
