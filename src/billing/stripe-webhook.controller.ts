import {
  Controller,
  Headers,
  Logger,
  Post,
  RawBodyRequest,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import Stripe from 'stripe';
import { BillingService } from './billing.service';
import { Public } from '../common/decorators/public.decorator';
import { SkipTransform } from '../common/decorators/skip-transform.decorator';

@Controller('webhooks')
export class StripeWebhookController {
  private readonly logger = new Logger(StripeWebhookController.name);

  constructor(private readonly billingService: BillingService) {}

  @Public()
  @SkipTransform()
  @Post('stripe')
  async handle(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const raw = req.rawBody ?? Buffer.from('');

    let event: Stripe.Event;
    try {
      if (this.billingService.hasWebhookSecret()) {
        event = this.billingService.constructEvent(raw, signature ?? '');
      } else {
        // Dev only: no signing secret configured — accept unverified.
        this.logger.warn('STRIPE_WEBHOOK_SECRET not set — accepting unverified webhook');
        event = JSON.parse(raw.toString('utf8')) as Stripe.Event;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(400).send(`Webhook Error: ${message}`);
      return;
    }

    await this.billingService.handleWebhookEvent(event);
    res.status(200).json({ received: true });
  }
}
