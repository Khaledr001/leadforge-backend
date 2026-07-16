import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { GeneratedSite, LeadStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { GeneratorService } from './generator.service';
import { DeployerService } from './deployer.service';
import { BatchGenerateDto } from './dto/batch-generate.dto';

export interface PaginatedSites {
  items: GeneratedSite[];
  total: number;
  page: number;
  limit: number;
}

export interface BatchGenerateSummary {
  matched: number;
  generated: number;
  failed: number;
  sites: { leadId: string; subdomain: string; deployUrl: string | null }[];
}

const DEPLOY_DELAY_MS = 5_000;

@Injectable()
export class SitesService {
  private readonly logger = new Logger(SitesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly generator: GeneratorService,
    private readonly deployer: DeployerService,
  ) {}

  async createAndDeploy(leadId: string): Promise<GeneratedSite> {
    const build = await this.generator.generateSite(leadId);
    try {
      const deploy = await this.deployer.deploySite(build.buildPath, build.subdomain);
      const site = await this.prisma.generatedSite.create({
        data: {
          leadId,
          templateId: build.templateId,
          subdomain: build.subdomain,
          deployUrl: deploy.deployUrl,
          generatedCopy: build.generatedCopy as unknown as Prisma.InputJsonValue,
        },
      });
      await this.prisma.lead.update({
        where: { id: leadId },
        data: { status: LeadStatus.SITE_BUILT },
      });
      return site;
    } finally {
      await this.generator.cleanup(build.buildDir);
    }
  }

  async batchGenerate(dto: BatchGenerateDto): Promise<BatchGenerateSummary> {
    const { city, category, limit = 10 } = dto;

    const where: Prisma.LeadWhereInput = {
      generatedSites: { none: {} },
      status: { notIn: [LeadStatus.UNSUBSCRIBED, LeadStatus.CLOSED_LOST] },
    };
    if (city) where.city = { equals: city, mode: 'insensitive' };
    if (category) where.category = { equals: category, mode: 'insensitive' };

    const leads = await this.prisma.lead.findMany({
      where,
      take: limit,
      orderBy: { createdAt: 'asc' },
    });

    const summary: BatchGenerateSummary = {
      matched: leads.length,
      generated: 0,
      failed: 0,
      sites: [],
    };

    for (let i = 0; i < leads.length; i += 1) {
      const lead = leads[i];
      try {
        const site = await this.createAndDeploy(lead.id);
        summary.generated += 1;
        summary.sites.push({
          leadId: lead.id,
          subdomain: site.subdomain,
          deployUrl: site.deployUrl,
        });
      } catch (err) {
        summary.failed += 1;
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(`Site generation failed for lead ${lead.id}: ${message}`);
      }
      if (i < leads.length - 1) {
        await this.delay(DEPLOY_DELAY_MS);
      }
    }

    this.logger.log(`Batch generate -> ${JSON.stringify(summary)}`);
    return summary;
  }

  async findAll(page: number, limit: number): Promise<PaginatedSites> {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.generatedSite.findMany({
        include: { lead: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.generatedSite.count(),
    ]);
    return { items, total, page, limit };
  }

  async findOne(id: string): Promise<GeneratedSite> {
    const site = await this.prisma.generatedSite.findUnique({
      where: { id },
      include: { lead: true },
    });
    if (!site) {
      throw new NotFoundException(`Site ${id} not found`);
    }
    return site;
  }

  async getAnalytics(id: string) {
    const site = await this.findOne(id);
    return {
      id: site.id,
      subdomain: site.subdomain,
      deployUrl: site.deployUrl,
      visitCount: site.visitCount,
      lastVisitedAt: site.lastVisitedAt,
      isClaimed: site.isClaimed,
      claimedAt: site.claimedAt,
      createdAt: site.createdAt,
    };
  }

  async recordVisit(id: string): Promise<GeneratedSite> {
    await this.ensureExists(id);
    return this.prisma.generatedSite.update({
      where: { id },
      data: { visitCount: { increment: 1 }, lastVisitedAt: new Date() },
    });
  }

  async remove(id: string): Promise<{ success: true }> {
    const site = await this.findOne(id);
    await this.deployer.teardownSite(site.subdomain);
    await this.prisma.generatedSite.delete({ where: { id } });
    this.logger.log(`Deleted site ${id} (${site.subdomain})`);
    return { success: true };
  }

  private async ensureExists(id: string): Promise<void> {
    const count = await this.prisma.generatedSite.count({ where: { id } });
    if (count === 0) {
      throw new NotFoundException(`Site ${id} not found`);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
