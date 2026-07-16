import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import * as Joi from 'joi';

import appConfig from './app.config';
import databaseConfig from './database.config';
import {
  anthropicConfig,
  cloudflareConfig,
  emailConfig,
  googleConfig,
  outscraperConfig,
  redisConfig,
  stripeConfig,
  vapiConfig,
} from './services.config';

/**
 * Global config module. Loads typed namespaces and validates the environment
 * with Joi at boot. External-service keys are optional so the app boots in
 * local dev without every credential; DATABASE_URL is required.
 */
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [
        appConfig,
        databaseConfig,
        googleConfig,
        outscraperConfig,
        anthropicConfig,
        cloudflareConfig,
        emailConfig,
        redisConfig,
        stripeConfig,
        vapiConfig,
      ],
      validationSchema: Joi.object({
        NODE_ENV: Joi.string()
          .valid('development', 'production', 'test')
          .default('development'),
        PORT: Joi.number().default(3001),
        API_BASE_URL: Joi.string().uri().default('http://localhost:3001'),
        DASHBOARD_URL: Joi.string().uri().default('http://localhost:3000'),

        // Database — Prisma needs DATABASE_URL; Supabase is optional (auth).
        DATABASE_URL: Joi.string().required(),
        SUPABASE_URL: Joi.string().uri().allow('').default(''),
        SUPABASE_ANON_KEY: Joi.string().allow('').default(''),
        SUPABASE_SERVICE_ROLE_KEY: Joi.string().allow('').default(''),

        // External services — optional in dev.
        GOOGLE_PLACES_API_KEY: Joi.string().allow('').default(''),
        OUTSCRAPER_API_KEY: Joi.string().allow('').default(''),
        ANTHROPIC_API_KEY: Joi.string().allow('').default(''),
        ANTHROPIC_MODEL: Joi.string().default('claude-sonnet-5'),
        CLOUDFLARE_API_TOKEN: Joi.string().allow('').default(''),
        CLOUDFLARE_ACCOUNT_ID: Joi.string().allow('').default(''),
        SITE_BASE_DOMAIN: Joi.string().allow('').default('yourbrand.site'),
        SMTP_HOST: Joi.string().allow('').default(''),
        SMTP_PORT: Joi.number().default(587),
        SMTP_USER: Joi.string().allow('').default(''),
        SMTP_PASS: Joi.string().allow('').default(''),
        SMTP_FROM_NAME: Joi.string().allow('').default('LeadForge'),
        SMTP_FROM_EMAIL: Joi.string().allow('').default('outreach@example.com'),
        SENDER_ADDRESS: Joi.string()
          .allow('')
          .default('123 Main Street, Austin, TX 78701'),
        OUTREACH_UNSUBSCRIBE_SECRET: Joi.string()
          .allow('')
          .default('leadforge-dev-unsubscribe-secret'),
        REDIS_URL: Joi.string().default('redis://localhost:6379'),
        STRIPE_SECRET_KEY: Joi.string().allow('').default(''),
        STRIPE_WEBHOOK_SECRET: Joi.string().allow('').default(''),
        VAPI_API_KEY: Joi.string().allow('').default(''),
      }),
      validationOptions: {
        allowUnknown: true,
        abortEarly: false,
      },
    }),
  ],
})
export class ConfigModule {}
