import { Injectable, NotFoundException } from '@nestjs/common';
import { Lead } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AiCopyService } from '../ai-copy/ai-copy.service';
import { BusinessContext, GBPReport } from '../ai-copy/interfaces/ai-copy.types';

@Injectable()
export class GbpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiCopy: AiCopyService,
  ) {}

  async generateReport(clientId: string): Promise<GBPReport> {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      include: { lead: true },
    });
    if (!client) {
      throw new NotFoundException(`Client ${clientId} not found`);
    }
    return this.aiCopy.generateGBPSuggestions(this.toContext(client.lead));
  }

  private toContext(lead: Lead): BusinessContext {
    return {
      businessName: lead.businessName,
      category: lead.category,
      city: lead.city,
      state: lead.state,
      googleRating: lead.googleRating == null ? null : Number(lead.googleRating),
      googleReviewCount: lead.googleReviewCount,
    };
  }
}
