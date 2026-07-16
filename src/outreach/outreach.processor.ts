import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailerService } from '@nestjs-modules/mailer';
import { LeadStatus, OutreachStepStatus } from '@prisma/client';
import { Job } from 'bullmq';
import { PrismaService } from '../database/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { EmailBuilder } from './email.builder';
import { stepByNumber } from './constants/sequence';
import { createUnsubscribeToken } from './unsubscribe-token';

interface SendJobData {
  stepId: string;
}

@Processor('outreach', {
  // CAN-SPAM-friendly throttle: at most 30 emails per hour per sender.
  limiter: { max: 30, duration: 60 * 60 * 1000 },
})
export class OutreachProcessor extends WorkerHost {
  private readonly logger = new Logger(OutreachProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: MailerService,
    private readonly config: ConfigService,
    private readonly emailBuilder: EmailBuilder,
    private readonly analytics: AnalyticsService,
  ) {
    super();
  }

  async process(job: Job<SendJobData>): Promise<void> {
    const step = await this.prisma.outreachSequence.findUnique({
      where: { id: job.data.stepId },
      include: {
        lead: {
          include: { generatedSites: { orderBy: { createdAt: 'desc' }, take: 1 } },
        },
      },
    });

    if (!step) {
      this.logger.warn(`Step ${job.data.stepId} no longer exists — skipping`);
      return;
    }
    if (step.status !== OutreachStepStatus.SCHEDULED) {
      this.logger.log(`Step ${step.id} is ${step.status} — skipping`);
      return;
    }
    if (step.lead.status === LeadStatus.UNSUBSCRIBED) {
      await this.prisma.outreachSequence.update({
        where: { id: step.id },
        data: { status: OutreachStepStatus.CANCELLED },
      });
      return;
    }

    const config = stepByNumber(step.stepNumber);
    if (!config) {
      this.logger.error(`No template config for step number ${step.stepNumber}`);
      return;
    }

    const apiUrl = this.config.get<string>('app.apiUrl') ?? 'http://localhost:3001';
    const baseDomain = this.config.get<string>('cloudflare.baseDomain') ?? 'example.com';
    const secret =
      this.config.get<string>('app.unsubscribeSecret') ?? 'leadforge-dev-unsubscribe-secret';
    const senderName = this.config.get<string>('email.fromName') ?? 'LeadForge';
    const physicalAddress =
      this.config.get<string>('email.senderAddress') ?? '';
    const smtpHost = this.config.get<string>('email.host') ?? '';

    const site = step.lead.generatedSites[0];
    const siteUrl =
      site?.deployUrl ?? (site ? `https://${site.subdomain}.${baseDomain}` : apiUrl);

    const email = this.emailBuilder.buildEmail({
      step: config,
      stepId: step.id,
      businessName: step.lead.businessName,
      city: step.lead.city,
      leadId: step.lead.id,
      siteUrl,
      apiUrl,
      unsubscribeUrl: `${apiUrl}/outreach/unsubscribe/${createUnsubscribeToken(step.lead.id, secret)}`,
      senderName,
      physicalAddress,
    });

    if (smtpHost) {
      try {
        await this.mailer.sendMail({
          to: step.lead.email ?? undefined,
          subject: email.subject,
          html: email.html,
          text: email.text,
        });
      } catch (err) {
        await this.prisma.outreachSequence.update({
          where: { id: step.id },
          data: { status: OutreachStepStatus.FAILED },
        });
        throw err;
      }
    } else {
      this.logger.warn(
        `[dry-run] SMTP not configured — would send step ${step.stepNumber} "${email.subject}" to ${step.lead.email ?? '(no email)'}`,
      );
    }

    await this.prisma.outreachSequence.update({
      where: { id: step.id },
      data: {
        sentAt: new Date(),
        status: OutreachStepStatus.SENT,
        body: email.text,
      },
    });
    if (step.stepNumber === 1) {
      await this.prisma.lead.update({
        where: { id: step.lead.id },
        data: { status: LeadStatus.CONTACTED },
      });
    }
    await this.analytics.logEvent(step.lead.id, 'email_sent', {
      stepNumber: step.stepNumber,
      subject: email.subject,
    });

    this.logger.log(`Sent step ${step.stepNumber} for lead ${step.lead.id}`);
  }
}
