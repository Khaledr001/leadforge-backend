import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AnalyticsModule } from '../analytics/analytics.module';
import { OutreachController } from './outreach.controller';
import { OutreachService } from './outreach.service';
import { OutreachProcessor } from './outreach.processor';
import { EmailBuilder } from './email.builder';

@Module({
  imports: [BullModule.registerQueue({ name: 'outreach' }), AnalyticsModule],
  controllers: [OutreachController],
  providers: [OutreachService, OutreachProcessor, EmailBuilder],
  exports: [OutreachService],
})
export class OutreachModule {}
