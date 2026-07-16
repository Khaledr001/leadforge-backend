import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientPlan, LeadStatus } from '@prisma/client';
import Stripe from 'stripe';
import { PrismaService } from '../database/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { STRIPE_CLIENT } from './stripe.provider';
import { isClientPlan, PLANS } from './constants/plans';

type StripeRef = string | { id: string } | null | undefined;

export interface InvoiceSummary {
  id: string | null;
  amountPaid: number;
  currency: string;
  status: string | null;
  created: Date;
  hostedInvoiceUrl: string | null;
}

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly configured: boolean;
  private readonly webhookSecret: string;
  private readonly dashboardUrl: string;

  constructor(
    @Inject(STRIPE_CLIENT) private readonly stripe: Stripe,
    private readonly prisma: PrismaService,
    private readonly analytics: AnalyticsService,
    private readonly config: ConfigService,
  ) {
    this.configured = Boolean(this.config.get<string>('stripe.secretKey'));
    this.webhookSecret = this.config.get<string>('stripe.webhookSecret') ?? '';
    this.dashboardUrl =
      this.config.get<string>('app.dashboardUrl') ?? 'http://localhost:3000';
  }

  async createCustomer(leadId: string): Promise<Stripe.Customer> {
    this.ensureConfigured();
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) {
      throw new NotFoundException(`Lead ${leadId} not found`);
    }
    return this.stripe.customers.create({
      name: lead.businessName,
      email: lead.email ?? undefined,
      metadata: { leadId: lead.id },
    });
  }

  async createCheckoutSession(
    leadId: string,
    plan: ClientPlan,
  ): Promise<{ url: string | null; sessionId: string }> {
    this.ensureConfigured();
    const config = PLANS[plan];
    const customer = await this.createCustomer(leadId);

    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customer.id,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            product_data: { name: `LeadForge — ${config.name}` },
            unit_amount: config.amountCents,
            recurring: { interval: 'month' },
          },
        },
      ],
      metadata: { leadId, plan },
      subscription_data: { metadata: { leadId, plan } },
      success_url: `${this.dashboardUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${this.dashboardUrl}/billing/cancel`,
    });

    return { url: session.url, sessionId: session.id };
  }

  async cancelSubscription(clientId: string): Promise<{ cancelled: boolean }> {
    this.ensureConfigured();
    const client = await this.prisma.client.findUnique({ where: { id: clientId } });
    if (!client) {
      throw new NotFoundException(`Client ${clientId} not found`);
    }
    if (!client.stripeCustomerId) {
      return { cancelled: false };
    }
    const subs = await this.stripe.subscriptions.list({
      customer: client.stripeCustomerId,
      status: 'active',
      limit: 1,
    });
    if (subs.data.length === 0) {
      return { cancelled: false };
    }
    await this.stripe.subscriptions.cancel(subs.data[0].id);
    return { cancelled: true };
  }

  async getInvoices(clientId: string): Promise<InvoiceSummary[]> {
    this.ensureConfigured();
    const client = await this.prisma.client.findUnique({ where: { id: clientId } });
    if (!client) {
      throw new NotFoundException(`Client ${clientId} not found`);
    }
    if (!client.stripeCustomerId) {
      return [];
    }
    const invoices = await this.stripe.invoices.list({
      customer: client.stripeCustomerId,
      limit: 20,
    });
    return invoices.data.map((invoice) => ({
      id: invoice.id ?? null,
      amountPaid: invoice.amount_paid,
      currency: invoice.currency,
      status: invoice.status,
      created: new Date(invoice.created * 1000),
      hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
    }));
  }

  /** Verifies + parses a Stripe webhook payload. */
  constructEvent(payload: Buffer, signature: string): Stripe.Event {
    return this.stripe.webhooks.constructEvent(payload, signature, this.webhookSecret);
  }

  hasWebhookSecret(): boolean {
    return Boolean(this.webhookSecret);
  }

  async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed':
        await this.onCheckoutCompleted(event.data.object);
        break;
      case 'invoice.paid':
        await this.onInvoicePaid(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await this.onSubscriptionDeleted(event.data.object);
        break;
      default:
        this.logger.debug(`Unhandled Stripe event: ${event.type}`);
    }
  }

  private async onCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const leadId = session.metadata?.leadId;
    const planRaw = session.metadata?.plan ?? '';
    if (!leadId || !isClientPlan(planRaw)) {
      this.logger.warn('checkout.session.completed missing/invalid metadata');
      return;
    }
    const customerId = this.toId(session.customer);

    await this.prisma.client.upsert({
      where: { leadId },
      create: {
        leadId,
        stripeCustomerId: customerId,
        plan: planRaw,
        mrr: PLANS[planRaw].amountCents,
      },
      update: {
        stripeCustomerId: customerId,
        plan: planRaw,
        mrr: PLANS[planRaw].amountCents,
        churnedAt: null,
      },
    });
    await this.prisma.generatedSite.updateMany({
      where: { leadId },
      data: { isClaimed: true, claimedAt: new Date() },
    });
    await this.prisma.lead.update({
      where: { id: leadId },
      data: { status: LeadStatus.CLOSED_WON },
    });
    await this.analytics.logEvent(leadId, 'checkout_completed', {
      plan: planRaw,
      customerId: customerId ?? null,
    });
    this.logger.log(`Client created for lead ${leadId} on plan ${planRaw}`);
  }

  private async onInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
    const customerId = this.toId(invoice.customer);
    if (!customerId) return;
    const client = await this.prisma.client.findFirst({
      where: { stripeCustomerId: customerId },
    });
    if (!client) return;
    await this.analytics.logEvent(client.leadId, 'invoice_paid', {
      amountPaid: invoice.amount_paid,
      invoiceId: invoice.id ?? null,
    });
  }

  private async onSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    const customerId = this.toId(subscription.customer);
    if (!customerId) return;
    const client = await this.prisma.client.findFirst({
      where: { stripeCustomerId: customerId },
    });
    if (!client) return;
    await this.prisma.client.update({
      where: { id: client.id },
      data: { churnedAt: new Date() },
    });
    await this.prisma.aiService.updateMany({
      where: { clientId: client.id },
      data: { isActive: false },
    });
    await this.analytics.logEvent(client.leadId, 'subscription_churned', {
      customerId,
    });
    this.logger.log(`Client ${client.id} churned`);
  }

  private toId(value: StripeRef): string | null {
    if (!value) return null;
    return typeof value === 'string' ? value : value.id;
  }

  private ensureConfigured(): void {
    if (!this.configured) {
      throw new ServiceUnavailableException('STRIPE_SECRET_KEY is not configured');
    }
  }
}
