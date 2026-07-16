import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AiService, Prisma, ServiceType } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { VapiClient } from './vapi.client';
import {
  RECEPTIONIST_MONTHLY_COST,
  RECEPTIONIST_MONTHLY_PRICE,
} from './constants';

@Injectable()
export class ReceptionistService {
  private readonly logger = new Logger(ReceptionistService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly vapi: VapiClient,
    private readonly analytics: AnalyticsService,
  ) {}

  async setupAssistant(clientId: string): Promise<AiService> {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      include: { lead: true },
    });
    if (!client) {
      throw new NotFoundException(`Client ${clientId} not found`);
    }
    const existing = await this.prisma.aiService.findFirst({
      where: { clientId, serviceType: ServiceType.AI_RECEPTIONIST },
    });
    if (existing) {
      throw new ConflictException('Receptionist already set up for this client');
    }

    const systemPrompt = this.buildSystemPrompt(client.lead);
    let vapiAssistantId: string | null = null;
    let phoneNumber: string | null = null;

    if (this.vapi.configured) {
      try {
        const assistant = await this.vapi.createAssistant({
          name: `${client.lead.businessName} Receptionist`,
          firstMessage: `Thanks for calling ${client.lead.businessName}! How can I help you today?`,
          model: {
            provider: 'openai',
            model: 'gpt-4o-mini',
            messages: [{ role: 'system', content: systemPrompt }],
          },
        });
        vapiAssistantId = assistant.id;
        const phone = await this.vapi
          .provisionPhoneNumber(assistant.id)
          .catch(() => null);
        phoneNumber = phone?.number ?? null;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new ServiceUnavailableException(`Vapi setup failed: ${message}`);
      }
    } else {
      this.logger.warn(
        'VAPI_API_KEY not configured — creating receptionist record without a live assistant',
      );
    }

    const service = await this.prisma.aiService.create({
      data: {
        clientId,
        serviceType: ServiceType.AI_RECEPTIONIST,
        config: { systemPrompt, phoneNumber } as Prisma.InputJsonObject,
        vapiAssistantId,
        isActive: Boolean(vapiAssistantId),
        monthlyCost: RECEPTIONIST_MONTHLY_COST,
        monthlyPrice: RECEPTIONIST_MONTHLY_PRICE,
      },
    });
    this.logger.log(`Receptionist service ${service.id} set up for client ${clientId}`);
    return service;
  }

  async updateAssistant(
    serviceId: string,
    config: Prisma.InputJsonObject,
  ): Promise<AiService> {
    const service = await this.getService(serviceId);
    if (this.vapi.configured && service.vapiAssistantId) {
      await this.vapi.updateAssistant(service.vapiAssistantId, config).catch((err) => {
        this.logger.error(`Vapi update failed: ${(err as Error).message}`);
      });
    }
    return this.prisma.aiService.update({
      where: { id: serviceId },
      data: { config },
    });
  }

  async getCallLogs(serviceId: string): Promise<unknown[]> {
    const service = await this.getService(serviceId);
    if (!service.vapiAssistantId || !this.vapi.configured) {
      return [];
    }
    return this.vapi.listCalls(service.vapiAssistantId);
  }

  async handleWebhook(payload: Record<string, unknown>): Promise<void> {
    const assistantId = this.extractAssistantId(payload);
    if (!assistantId) {
      this.logger.warn('Vapi webhook without an assistant id');
      return;
    }
    const service = await this.prisma.aiService.findFirst({
      where: { vapiAssistantId: assistantId },
      include: { client: true },
    });
    if (!service) {
      this.logger.warn(`No service for Vapi assistant ${assistantId}`);
      return;
    }
    const eventType =
      (this.readPath(payload, ['message', 'type']) as string | undefined) ??
      (payload.type as string | undefined) ??
      'unknown';
    await this.analytics.logEvent(service.client.leadId, 'vapi_call', {
      assistantId,
      eventType,
    });
  }

  private async getService(serviceId: string): Promise<AiService> {
    const service = await this.prisma.aiService.findUnique({ where: { id: serviceId } });
    if (!service) {
      throw new NotFoundException(`Service ${serviceId} not found`);
    }
    return service;
  }

  private buildSystemPrompt(lead: {
    businessName: string;
    category: string | null;
    city: string | null;
  }): string {
    const category = lead.category ?? 'local service';
    const city = lead.city ?? 'the area';
    return (
      `You are the virtual receptionist for ${lead.businessName}, a ${category} business in ${city}. ` +
      `You answer calls, provide information about services, hours, and location, and collect ` +
      `caller information for callbacks. Be friendly, professional, and helpful.`
    );
  }

  private extractAssistantId(payload: Record<string, unknown>): string | null {
    return (
      (this.readPath(payload, ['assistantId']) as string | undefined) ??
      (this.readPath(payload, ['message', 'assistantId']) as string | undefined) ??
      (this.readPath(payload, ['call', 'assistantId']) as string | undefined) ??
      null
    );
  }

  private readPath(obj: Record<string, unknown>, path: string[]): unknown {
    let current: unknown = obj;
    for (const key of path) {
      if (typeof current !== 'object' || current === null) return undefined;
      current = (current as Record<string, unknown>)[key];
    }
    return current;
  }
}
