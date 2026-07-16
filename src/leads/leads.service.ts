import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Lead, LeadStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { FilterLeadsDto } from './dto/filter-leads.dto';

export interface PaginatedLeads {
  items: Lead[];
  total: number;
  page: number;
  limit: number;
}

export interface LeadStats {
  total: number;
  byStatus: Record<LeadStatus, number>;
  byCity: { city: string; count: number }[];
  noWebsite: number;
}

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(filters: FilterLeadsDto): Promise<PaginatedLeads> {
    const { city, category, status, hasWebsite, page, limit, sortBy, sortOrder } =
      filters;

    const where: Prisma.LeadWhereInput = {};
    if (city) where.city = { equals: city, mode: 'insensitive' };
    if (category) where.category = { equals: category, mode: 'insensitive' };
    if (status) where.status = status;
    if (hasWebsite === true) where.websiteUrl = { not: null };
    if (hasWebsite === false) where.websiteUrl = null;

    const orderBy = { [sortBy]: sortOrder } as Prisma.LeadOrderByWithRelationInput;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.lead.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.lead.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async findOne(id: string): Promise<Lead> {
    const lead = await this.prisma.lead.findUnique({
      where: { id },
      include: {
        generatedSites: true,
        outreachSteps: { orderBy: { stepNumber: 'asc' } },
        client: { include: { aiServices: true } },
        analyticsEvents: { orderBy: { createdAt: 'desc' }, take: 50 },
      },
    });
    if (!lead) {
      throw new NotFoundException(`Lead ${id} not found`);
    }
    return lead;
  }

  async create(dto: CreateLeadDto): Promise<Lead> {
    const lead = await this.prisma.lead.create({
      data: { ...dto } as Prisma.LeadUncheckedCreateInput,
    });
    this.logger.log(`Created lead ${lead.id} (${lead.businessName})`);
    return lead;
  }

  async update(id: string, dto: UpdateLeadDto): Promise<Lead> {
    await this.ensureExists(id);
    return this.prisma.lead.update({
      where: { id },
      data: { ...dto } as Prisma.LeadUncheckedUpdateInput,
    });
  }

  async remove(id: string): Promise<{ success: true }> {
    await this.ensureExists(id);
    await this.prisma.lead.delete({ where: { id } });
    this.logger.log(`Deleted lead ${id}`);
    return { success: true };
  }

  async getStats(): Promise<LeadStats> {
    const [total, noWebsite, byStatusRaw, byCityRaw] = await Promise.all([
      this.prisma.lead.count(),
      this.prisma.lead.count({ where: { websiteUrl: null } }),
      this.prisma.lead.groupBy({
        by: ['status'],
        _count: { _all: true },
        orderBy: { status: 'asc' },
      }),
      this.prisma.lead.groupBy({
        by: ['city'],
        _count: { _all: true },
        orderBy: { city: 'asc' },
      }),
    ]);

    const byStatus = Object.values(LeadStatus).reduce(
      (acc, s) => {
        acc[s] = 0;
        return acc;
      },
      {} as Record<LeadStatus, number>,
    );
    for (const row of byStatusRaw) {
      byStatus[row.status] = row._count._all;
    }

    const byCity = byCityRaw
      .filter((r): r is typeof r & { city: string } => Boolean(r.city))
      .map((r) => ({ city: r.city, count: r._count._all }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    return { total, byStatus, byCity, noWebsite };
  }

  private async ensureExists(id: string): Promise<void> {
    const count = await this.prisma.lead.count({ where: { id } });
    if (count === 0) {
      throw new NotFoundException(`Lead ${id} not found`);
    }
  }
}
