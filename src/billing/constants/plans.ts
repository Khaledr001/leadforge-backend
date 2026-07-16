import { ClientPlan } from '@prisma/client';

export interface PlanConfig {
  name: string;
  amountCents: number;
}

/** Subscription plans and their monthly price (in cents). */
export const PLANS: Record<ClientPlan, PlanConfig> = {
  WEBSITE_ONLY: { name: 'Website Only', amountCents: 9900 },
  WEBSITE_PLUS_VOICE: { name: 'Website + Voice', amountCents: 29900 },
  FULL_PACKAGE: { name: 'Full Package', amountCents: 49900 },
};

export function isClientPlan(value: string): value is ClientPlan {
  return Object.prototype.hasOwnProperty.call(PLANS, value);
}
