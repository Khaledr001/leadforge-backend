import { Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { StripeWebhookController } from './stripe-webhook.controller';
import { stripeClientProvider } from './stripe.provider';

@Module({
  imports: [AnalyticsModule],
  controllers: [BillingController, StripeWebhookController],
  providers: [BillingService, stripeClientProvider],
  exports: [BillingService],
})
export class BillingModule {}
