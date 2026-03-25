import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1).optional(),
  TELEGRAM_CHANNEL_ID: z.string().optional(),
  X402_WEBHOOK_SECRET: z.string().optional(),
  PORT: z.coerce.number().int().positive().default(3000)
});

export const env = envSchema.parse(process.env);
