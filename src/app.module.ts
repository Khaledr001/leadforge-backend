import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { BullModule } from '@nestjs/bullmq';
import { MailerModule } from '@nestjs-modules/mailer';

import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { LeadsModule } from './leads/leads.module';
import { ScraperModule } from './scraper/scraper.module';
import { EnricherModule } from './enricher/enricher.module';
import { AiCopyModule } from './ai-copy/ai-copy.module';
import { SitesModule } from './sites/sites.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { OutreachModule } from './outreach/outreach.module';
import { BillingModule } from './billing/billing.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { AuthGuard } from './common/guards/auth.guard';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isProduction = config.get<boolean>('app.isProduction') ?? false;
        return {
          pinoHttp: {
            level: isProduction ? 'info' : 'debug',
            autoLogging: false,
            redact: ['req.headers.authorization'],
            transport: isProduction
              ? undefined
              : {
                  target: 'pino-pretty',
                  options: { singleLine: true, translateTime: 'SYS:standard' },
                },
          },
        };
      },
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisUrl =
          config.get<string>('redis.url') ?? 'redis://localhost:6379';
        const url = new URL(redisUrl);
        return {
          connection: {
            host: url.hostname,
            port: Number(url.port || 6379),
            username: url.username || undefined,
            password: url.password || undefined,
          },
        };
      },
    }),
    MailerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        transport: {
          host: config.get<string>('email.host') || 'localhost',
          port: config.get<number>('email.port') ?? 587,
          secure: false,
          auth: config.get<string>('email.user')
            ? {
                user: config.get<string>('email.user') ?? '',
                pass: config.get<string>('email.pass') ?? '',
              }
            : undefined,
        },
        defaults: {
          from: `"${config.get<string>('email.fromName') ?? 'LeadForge'}" <${
            config.get<string>('email.fromEmail') ?? 'outreach@example.com'
          }>`,
        },
      }),
    }),
    HealthModule,
    LeadsModule,
    ScraperModule,
    EnricherModule,
    AiCopyModule,
    SitesModule,
    AnalyticsModule,
    OutreachModule,
    BillingModule,
    // Feature modules added in later phases (10):
    // ClientsModule, AiServicesModule.
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
