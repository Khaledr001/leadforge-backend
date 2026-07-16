import { registerAs } from '@nestjs/config';

/** External service config namespaces. */

export const googleConfig = registerAs('google', () => ({
  placesApiKey: process.env.GOOGLE_PLACES_API_KEY ?? '',
}));

export const outscraperConfig = registerAs('outscraper', () => ({
  apiKey: process.env.OUTSCRAPER_API_KEY ?? '',
}));

export const anthropicConfig = registerAs('anthropic', () => ({
  apiKey: process.env.ANTHROPIC_API_KEY ?? '',
}));

export const cloudflareConfig = registerAs('cloudflare', () => ({
  apiToken: process.env.CLOUDFLARE_API_TOKEN ?? '',
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID ?? '',
  baseDomain: process.env.SITE_BASE_DOMAIN ?? 'yourbrand.site',
}));

export const emailConfig = registerAs('email', () => ({
  host: process.env.SMTP_HOST ?? '',
  port: parseInt(process.env.SMTP_PORT ?? '587', 10),
  user: process.env.SMTP_USER ?? '',
  pass: process.env.SMTP_PASS ?? '',
  fromName: process.env.SMTP_FROM_NAME ?? 'LeadForge',
  fromEmail: process.env.SMTP_FROM_EMAIL ?? 'outreach@example.com',
}));

export const redisConfig = registerAs('redis', () => ({
  url: process.env.REDIS_URL ?? 'redis://localhost:6379',
}));

export const stripeConfig = registerAs('stripe', () => ({
  secretKey: process.env.STRIPE_SECRET_KEY ?? '',
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
}));

export const vapiConfig = registerAs('vapi', () => ({
  apiKey: process.env.VAPI_API_KEY ?? '',
}));
