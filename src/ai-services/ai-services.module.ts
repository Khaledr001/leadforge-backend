import { Module } from '@nestjs/common';
import { AiCopyModule } from '../ai-copy/ai-copy.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { AiServicesController } from './ai-services.controller';
import { VapiWebhookController } from './vapi-webhook.controller';
import { ReceptionistService } from './receptionist.service';
import { SocialAgentService } from './social-agent.service';
import { GbpService } from './gbp.service';
import { VapiClient } from './vapi.client';

@Module({
  imports: [AiCopyModule, AnalyticsModule],
  controllers: [AiServicesController, VapiWebhookController],
  providers: [ReceptionistService, SocialAgentService, GbpService, VapiClient],
  exports: [ReceptionistService, SocialAgentService, GbpService],
})
export class AiServicesModule {}
