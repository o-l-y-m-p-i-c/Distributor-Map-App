import {z} from 'zod';

const envSchema = z.object({
  SHOPIFY_CLIENT_ID: z.string().min(1),
  SHOPIFY_SECRET: z.string().min(1),
  SHOPIFY_APP_URL: z.string().url(),
  SCOPES: z.string().default('read_products'),
  SHOPIFY_WEBHOOK_SECRET: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  DIRECT_DATABASE_URL: z.string().min(1),
  MAP_STYLE_URL: z.string().url(),
  GEOCODER_URL: z.string().url(),
  SESSION_SECRET: z.string().min(32),
  TOKEN_ENCRYPTION_KEY: z.string().min(32),
  APP_ENV: z.enum(['development', 'test', 'production']).default('development'),
  RENDER_EXTERNAL_URL: z.string().url().optional(),
});

export type AppEnv = z.infer<typeof envSchema>;

let cachedEnv: AppEnv | undefined;

export function getEnv(): AppEnv {
  cachedEnv ??= envSchema.parse(process.env);
  return cachedEnv;
}
