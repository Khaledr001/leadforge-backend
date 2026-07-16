import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async logEvent(
    leadId: string | null,
    eventType: string,
    metadata: Prisma.InputJsonObject = {},
  ): Promise<void> {
    await this.prisma.analyticsEvent.create({
      data: { leadId, eventType, metadata },
    });
  }

  /**
   * Records an email open for a lead: marks the most recent sent-but-unopened
   * outreach step as opened and logs an `email_open` event.
   */
  async recordEmailOpen(leadId: string): Promise<void> {
    const step = await this.prisma.outreachSequence.findFirst({
      where: { leadId, sentAt: { not: null }, openedAt: null },
      orderBy: { sentAt: 'desc' },
    });
    if (step) {
      await this.prisma.outreachSequence.update({
        where: { id: step.id },
        data: { openedAt: new Date() },
      });
    }
    await this.logEvent(leadId, 'email_open', { stepId: step?.id ?? null });
  }

  /** Records a click on a tracked link, setting the step's clickedAt. */
  async recordEmailClick(stepId: string, url: string): Promise<void> {
    const step = await this.prisma.outreachSequence.findUnique({ where: { id: stepId } });
    if (!step) {
      this.logger.warn(`Click for unknown step ${stepId}`);
      return;
    }
    if (!step.clickedAt) {
      await this.prisma.outreachSequence.update({
        where: { id: stepId },
        data: { clickedAt: new Date() },
      });
    }
    await this.logEvent(step.leadId, 'email_click', { stepId, url });
  }
}
