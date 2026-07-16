import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Lead, LeadStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { FacebookProvider } from './providers/facebook.provider';
import { EmailFinderProvider } from './providers/email-finder.provider';
import { MxCheckerProvider } from './providers/mx-checker.provider';
import { EnrichBatchDto } from './dto/enrich-batch.dto';

export interface EnrichmentResult {
  leadId: string;
  emailFound: boolean;
  phoneFound: boolean;
  email: string | null;
  phone: string | null;
  hours: string | null;
  description: string | null;
  sources: string[];
}

export interface BatchEnrichmentSummary {
  matched: number;
  processed: number;
  emailsFound: number;
  phonesFound: number;
}

export interface EnricherStats {
  totalLeads: number;
  enriched: number;
  emailsFound: number;
  phonesFound: number;
  withFacebook: number;
}

const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 2000;

@Injectable()
export class EnricherService {
  private readonly logger = new Logger(EnricherService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly facebook: FacebookProvider,
    private readonly emailFinder: EmailFinderProvider,
    private readonly mxChecker: MxCheckerProvider,
  ) {}

  async enrichLead(leadId: string): Promise<EnrichmentResult> {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) {
      throw new NotFoundException(`Lead ${leadId} not found`);
    }
    return this.enrich(lead);
  }

  /** Enriches NEW leads matching the filters, in batches of 10 with a delay. */
  async enrichBatch(dto: EnrichBatchDto): Promise<BatchEnrichmentSummary> {
    const { city, category, limit = 50 } = dto;

    const where: Prisma.LeadWhereInput = { status: LeadStatus.NEW };
    if (city) where.city = { equals: city, mode: 'insensitive' };
    if (category) where.category = { equals: category, mode: 'insensitive' };

    const leads = await this.prisma.lead.findMany({
      where,
      take: limit,
      orderBy: { createdAt: 'asc' },
    });

    const summary: BatchEnrichmentSummary = {
      matched: leads.length,
      processed: 0,
      emailsFound: 0,
      phonesFound: 0,
    };

    for (let i = 0; i < leads.length; i += BATCH_SIZE) {
      const batch = leads.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(batch.map((lead) => this.enrich(lead)));
      for (const result of results) {
        summary.processed += 1;
        if (result.emailFound) summary.emailsFound += 1;
        if (result.phoneFound) summary.phonesFound += 1;
      }
      if (i + BATCH_SIZE < leads.length) {
        await this.delay(BATCH_DELAY_MS);
      }
    }

    this.logger.log(`Batch enrich → ${JSON.stringify(summary)}`);
    return summary;
  }

  async getStats(): Promise<EnricherStats> {
    const [totalLeads, enriched, emailsFound, phonesFound, withFacebook] =
      await Promise.all([
        this.prisma.lead.count(),
        this.prisma.lead.count({
          where: { analyticsEvents: { some: { eventType: 'lead_enriched' } } },
        }),
        this.prisma.lead.count({ where: { email: { not: null } } }),
        this.prisma.lead.count({ where: { phone: { not: null } } }),
        this.prisma.lead.count({ where: { facebookUrl: { not: null } } }),
      ]);

    return { totalLeads, enriched, emailsFound, phonesFound, withFacebook };
  }

  private async enrich(lead: Lead): Promise<EnrichmentResult> {
    const sources: string[] = [];
    let email = lead.email ?? null;
    let phone = lead.phone ?? null;
    let hours: string | null = null;
    let description: string | null = null;

    // 1. Facebook About page (if we have a page URL).
    if (lead.facebookUrl) {
      const fb = await this.facebook.enrich(lead.facebookUrl);
      if (fb) {
        sources.push('facebook');
        if (!email && fb.email) email = fb.email;
        if (!phone && fb.phone) phone = fb.phone;
        if (fb.hours) hours = fb.hours;
        if (fb.description) description = fb.description;
      }
    }

    // 2. Email pattern from the website domain (only if still missing an email).
    if (!email && lead.websiteUrl) {
      const guess = await this.emailFinder.findEmail(
        lead.websiteUrl,
        lead.businessName,
      );
      if (guess) {
        email = guess;
        sources.push('email-pattern');
      }
    }

    const data: Prisma.LeadUpdateInput = { status: LeadStatus.ENRICHED };
    if (email && email !== lead.email) data.email = email;
    if (phone && phone !== lead.phone) data.phone = phone;
    await this.prisma.lead.update({ where: { id: lead.id }, data });

    // Persist the full enrichment (incl. hours/description that have no Lead
    // column) as an analytics event so it shows on the lead timeline.
    const metadata: Prisma.InputJsonObject = {
      sources,
      ...(email ? { email } : {}),
      ...(phone ? { phone } : {}),
      ...(hours ? { hours } : {}),
      ...(description ? { description } : {}),
    };
    await this.prisma.analyticsEvent.create({
      data: { leadId: lead.id, eventType: 'lead_enriched', metadata },
    });

    this.logger.debug(
      `Enriched ${lead.id} (${lead.businessName}) sources=[${sources.join(',')}]`,
    );

    return {
      leadId: lead.id,
      emailFound: Boolean(email),
      phoneFound: Boolean(phone),
      email,
      phone,
      hours,
      description,
      sources,
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
