import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { LeadStatus, OutreachChannel, OutreachStepStatus, Prisma } from '@prisma/client';
import { Queue } from 'bullmq';
import { PrismaService } from '../database/prisma.service';
import { DAY_MS, SEQUENCE_STEPS } from './constants/sequence';
import { verifyUnsubscribeToken } from './unsubscribe-token';

export interface OutreachStats {
  scheduled: number;
  sent: number;
  opened: number;
  clicked: number;
  replied: number;
  failed: number;
  cancelled: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
}

export interface StartBatchSummary {
  matched: number;
  started: number;
  failed: number;
}

@Injectable()
export class OutreachService {
  private readonly logger = new Logger(OutreachService.name);
  private readonly unsubscribeSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('outreach') private readonly queue: Queue,
    private readonly config: ConfigService,
  ) {
    this.unsubscribeSecret =
      this.config.get<string>('app.unsubscribeSecret') ??
      'leadforge-dev-unsubscribe-secret';
  }

  async startSequence(leadId: string): Promise<{ leadId: string; steps: number }> {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      include: { outreachSteps: { select: { id: true } } },
    });
    if (!lead) {
      throw new NotFoundException(`Lead ${leadId} not found`);
    }
    if (lead.status === LeadStatus.UNSUBSCRIBED) {
      throw new BadRequestException('Lead has unsubscribed');
    }
    if (lead.outreachSteps.length > 0) {
      throw new ConflictException('Lead already has an outreach sequence');
    }

    const now = Date.now();
    for (const step of SEQUENCE_STEPS) {
      const delay = step.delayDays * DAY_MS;
      const created = await this.prisma.outreachSequence.create({
        data: {
          leadId,
          channel: OutreachChannel.EMAIL,
          stepNumber: step.stepNumber,
          scheduledAt: new Date(now + delay),
          subject: step.subject.replace('{{businessName}}', lead.businessName),
          status: OutreachStepStatus.SCHEDULED,
        },
      });
      await this.queue.add(
        'send-step',
        { stepId: created.id },
        {
          delay,
          jobId: created.id,
          attempts: 3,
          backoff: { type: 'exponential', delay: 60_000 },
          removeOnComplete: true,
          removeOnFail: false,
        },
      );
    }

    this.logger.log(`Started ${SEQUENCE_STEPS.length}-step sequence for lead ${leadId}`);
    return { leadId, steps: SEQUENCE_STEPS.length };
  }

  async startBatch(filters: {
    city?: string;
    category?: string;
    limit?: number;
  }): Promise<StartBatchSummary> {
    const { city, category, limit = 25 } = filters;
    const where: Prisma.LeadWhereInput = {
      generatedSites: { some: {} },
      outreachSteps: { none: {} },
      email: { not: null },
      status: { notIn: [LeadStatus.UNSUBSCRIBED, LeadStatus.CLOSED_LOST] },
    };
    if (city) where.city = { equals: city, mode: 'insensitive' };
    if (category) where.category = { equals: category, mode: 'insensitive' };

    const leads = await this.prisma.lead.findMany({
      where,
      take: limit,
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });

    const summary: StartBatchSummary = { matched: leads.length, started: 0, failed: 0 };
    for (const lead of leads) {
      try {
        await this.startSequence(lead.id);
        summary.started += 1;
      } catch (err) {
        summary.failed += 1;
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(`Failed to start sequence for lead ${lead.id}: ${message}`);
      }
    }
    return summary;
  }

  async cancelSequence(leadId: string): Promise<{ cancelled: number }> {
    const steps = await this.prisma.outreachSequence.findMany({
      where: { leadId, status: OutreachStepStatus.SCHEDULED },
      select: { id: true },
    });
    for (const step of steps) {
      await this.queue.remove(step.id).catch(() => undefined);
    }
    const result = await this.prisma.outreachSequence.updateMany({
      where: { leadId, status: OutreachStepStatus.SCHEDULED },
      data: { status: OutreachStepStatus.CANCELLED },
    });
    return { cancelled: result.count };
  }

  async handleUnsubscribe(token: string): Promise<{ success: boolean; message: string }> {
    const leadId = verifyUnsubscribeToken(token, this.unsubscribeSecret);
    if (!leadId) {
      throw new BadRequestException('Invalid unsubscribe token');
    }
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }
    await this.prisma.lead.update({
      where: { id: leadId },
      data: { status: LeadStatus.UNSUBSCRIBED },
    });
    await this.cancelSequence(leadId);
    this.logger.log(`Lead ${leadId} unsubscribed`);
    return { success: true, message: 'You have been unsubscribed.' };
  }

  async pause(): Promise<{ paused: true }> {
    await this.queue.pause();
    return { paused: true };
  }

  async resume(): Promise<{ resumed: true }> {
    await this.queue.resume();
    return { resumed: true };
  }

  /** Leads with outreach sequences and their steps (dashboard sequence table). */
  async listSequences(limit = 50) {
    return this.prisma.lead.findMany({
      where: { outreachSteps: { some: {} } },
      include: { outreachSteps: { orderBy: { stepNumber: 'asc' } } },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });
  }

  async getStats(): Promise<OutreachStats> {
    const [scheduled, sent, opened, clicked, replied, failed, cancelled] =
      await Promise.all([
        this.prisma.outreachSequence.count({ where: { status: OutreachStepStatus.SCHEDULED } }),
        this.prisma.outreachSequence.count({ where: { sentAt: { not: null } } }),
        this.prisma.outreachSequence.count({ where: { openedAt: { not: null } } }),
        this.prisma.outreachSequence.count({ where: { clickedAt: { not: null } } }),
        this.prisma.outreachSequence.count({ where: { repliedAt: { not: null } } }),
        this.prisma.outreachSequence.count({ where: { status: OutreachStepStatus.FAILED } }),
        this.prisma.outreachSequence.count({ where: { status: OutreachStepStatus.CANCELLED } }),
      ]);

    const rate = (n: number) => (sent > 0 ? Math.round((n / sent) * 1000) / 10 : 0);
    return {
      scheduled,
      sent,
      opened,
      clicked,
      replied,
      failed,
      cancelled,
      openRate: rate(opened),
      clickRate: rate(clicked),
      replyRate: rate(replied),
    };
  }
}
