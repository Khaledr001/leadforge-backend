import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface VapiAssistant {
  id: string;
}

export interface VapiPhoneNumber {
  id: string;
  number?: string;
}

/**
 * Thin wrapper around the Vapi REST API. Reports `configured` so callers can
 * degrade gracefully when VAPI_API_KEY is absent.
 */
@Injectable()
export class VapiClient {
  private readonly logger = new Logger(VapiClient.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>('vapi.apiKey') ?? '';
    this.baseUrl = config.get<string>('vapi.baseUrl') ?? 'https://api.vapi.ai';
  }

  get configured(): boolean {
    return Boolean(this.apiKey);
  }

  async createAssistant(payload: Record<string, unknown>): Promise<VapiAssistant> {
    return this.request<VapiAssistant>('POST', '/assistant', payload);
  }

  async updateAssistant(
    assistantId: string,
    payload: Record<string, unknown>,
  ): Promise<VapiAssistant> {
    return this.request<VapiAssistant>('PATCH', `/assistant/${assistantId}`, payload);
  }

  async provisionPhoneNumber(assistantId: string): Promise<VapiPhoneNumber> {
    return this.request<VapiPhoneNumber>('POST', '/phone-number', {
      provider: 'vapi',
      assistantId,
    });
  }

  async listCalls(assistantId: string): Promise<unknown[]> {
    const result = await this.request<unknown>(
      'GET',
      `/call?assistantId=${encodeURIComponent(assistantId)}`,
    );
    return Array.isArray(result) ? result : [];
  }

  private async request<T>(
    method: string,
    path: string,
    body?: Record<string, unknown>,
  ): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new BadGatewayException(`Vapi ${method} ${path} failed: ${res.status} ${text}`);
    }
    return (await res.json()) as T;
  }
}
