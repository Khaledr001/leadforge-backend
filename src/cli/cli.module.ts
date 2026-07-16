import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { MailerModule } from '@nestjs-modules/mailer';
import { ConfigModule } from '../config/config.module';
import { DatabaseModule } from '../database/database.module';
import { ScraperModule } from '../scraper/scraper.module';
import { EnricherModule } from '../enricher/enricher.module';
import { SitesModule } from '../sites/sites.module';
import { OutreachModule } from '../outreach/outreach.module';
import {
  EnrichCommand,
  GenerateSiteCommand,
  GenerateSitesCommand,
  OutreachStatsCommand,
  ScrapeCommand,
  StartOutreachCommand,
} from './commands';

/** Root module for the nest-commander CLI (src/cli.ts). */
@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = new URL(config.get<string>('redis.url') ?? 'redis://localhost:6379');
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
        },
        defaults: {
          from: `"${config.get<string>('email.fromName') ?? 'LeadForge'}" <${config.get<string>('email.fromEmail') ?? 'outreach@example.com'}>`,
        },
      }),
    }),
    ScraperModule,
    EnricherModule,
    SitesModule,
    OutreachModule,
  ],
  providers: [
    ScrapeCommand,
    EnrichCommand,
    GenerateSiteCommand,
    GenerateSitesCommand,
    StartOutreachCommand,
    OutreachStatsCommand,
  ],
})
export class CliModule {}
