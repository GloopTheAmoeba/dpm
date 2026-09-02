import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  DISCORD_BOT_TOKEN: z.string().min(1, 'DISCORD_BOT_TOKEN is required'),
  DISCORD_CLIENT_ID: z.string().min(1, 'DISCORD_CLIENT_ID is required'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  TELEGRAM_BOT_TOKEN: z.string().min(1, 'TELEGRAM_BOT_TOKEN is required'),
  TELEGRAM_OWNER_ID: z.string().transform((val, ctx) => {
    const num = Number(val);
    if (isNaN(num) || !Number.isInteger(num)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'TELEGRAM_OWNER_ID must be a valid integer number',
      });
      return z.NEVER;
    }
    return num;
  }),
  TELEGRAM_WEBHOOK_SECRET: z.string().min(1, 'TELEGRAM_WEBHOOK_SECRET is required'),
  APP_URL: z.string().url('APP_URL must be a valid URL'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000').transform((val) => parseInt(val, 10)),
});

export type Config = z.infer<typeof envSchema>;

export function loadConfig(overrideEnv?: Record<string, string>): Config {
  const env = overrideEnv || process.env;
  const result = envSchema.safeParse(env);

  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
    throw new Error(`Invalid environment variables: ${issues}`);
  }

  return result.data;
}

let cachedConfig: Config | null = null;

export function getConfig(): Config {
  if (!cachedConfig) {
    cachedConfig = loadConfig();
  }
  return cachedConfig;
}
