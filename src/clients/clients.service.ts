import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Client, ClientPlan } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { PLANS } from '../billing/constants/plans';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

export interface PaginatedClients {
  items: Client[];
  total: number;
  page: number;
  limit: number;
}

export interface ClientStats {
  total: number;
  active: number;
  churned: number;
  mrr: number;
  byPlan: Record<ClientPlan, number>;
}

@Injectable()
export class ClientsService {
  private readonly logger = new Logger(ClientsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateClientDto): Promise<Client> {
    const lead = await this.prisma.lead.findUnique({ where: { id: dto.leadId } });
    if (!lead) {
      throw new NotFoundException(`Lead ${dto.leadId} not found`);
    }
    const existing = await this.prisma.client.findUnique({
      where: { leadId: dto.leadId },
    });
    if (existing) {
      throw new ConflictException('Lead is already a client');
    }
    const mrr = dto.mrr ?? PLANS[dto.plan].amountCents;
    const client = await this.prisma.client.create({
      data: { leadId: dto.leadId, plan: dto.plan, mrr },
      include: { lead: true },
    });
    this.logger.log(`Created client ${client.id} for lead ${dto.leadId}`);
    return client;
  }

  async findAll(page: number, limit: number): Promise<PaginatedClients> {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.client.findMany({
        include: { lead: true, aiServices: true },
        orderBy: { startedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.client.count(),
    ]);
    return { items, total, page, limit };
  }

  async findOne(id: string): Promise<Client> {
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: {
        lead: true,
        aiServices: true,
        socialPosts: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
    if (!client) {
      throw new NotFoundException(`Client ${id} not found`);
    }
    return client;
  }

  async update(id: string, dto: UpdateClientDto): Promise<Client> {
    await this.ensureExists(id);
    return this.prisma.client.update({ where: { id }, data: dto });
  }

  async getStats(): Promise<ClientStats> {
    const [total, active, mrrAgg, byPlanRaw] = await Promise.all([
      this.prisma.client.count(),
      this.prisma.client.count({ where: { churnedAt: null } }),
      this.prisma.client.aggregate({
        _sum: { mrr: true },
        where: { churnedAt: null },
      }),
      this.prisma.client.groupBy({
        by: ['plan'],
        _count: { _all: true },
        orderBy: { plan: 'asc' },
      }),
    ]);

    const byPlan = Object.values(ClientPlan).reduce(
      (acc, plan) => {
        acc[plan] = 0;
        return acc;
      },
      {} as Record<ClientPlan, number>,
    );
    for (const row of byPlanRaw) {
      byPlan[row.plan] = row._count._all;
    }

    return {
      total,
      active,
      churned: total - active,
      mrr: mrrAgg._sum.mrr ?? 0,
      byPlan,
    };
  }

  private async ensureExists(id: string): Promise<void> {
    const count = await this.prisma.client.count({ where: { id } });
    if (count === 0) {
      throw new NotFoundException(`Client ${id} not found`);
    }
  }
}
