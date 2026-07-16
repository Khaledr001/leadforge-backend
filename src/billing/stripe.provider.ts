import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

/** DI token for the shared Stripe client. */
export const STRIPE_CLIENT = Symbol('STRIPE_CLIENT');

/**
 * Provides a singleton Stripe client from config. A placeholder key keeps the
 * app booting when Stripe isn't configured — BillingService guards API calls
 * and returns 503; webhook signature verification only needs the webhook
 * secret, not the API key.
 */
export const stripeClientProvider: Provider = {
  provide: STRIPE_CLIENT,
  inject: [ConfigService],
  useFactory: (config: ConfigService): Stripe => {
    const secretKey = config.get<string>('stripe.secretKey') ?? '';
    return new Stripe(secretKey || 'sk_test_not_configured');
  },
};
