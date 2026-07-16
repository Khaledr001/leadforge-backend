import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';

/** DI token for the shared Anthropic SDK client. */
export const ANTHROPIC_CLIENT = Symbol('ANTHROPIC_CLIENT');

/**
 * Provides a singleton Anthropic client built from config. A placeholder key
 * is used when none is configured so the app still boots — AiCopyService guards
 * every call and returns 503 when the key is actually missing.
 */
export const anthropicClientProvider: Provider = {
  provide: ANTHROPIC_CLIENT,
  inject: [ConfigService],
  useFactory: (config: ConfigService): Anthropic => {
    const apiKey = config.get<string>('anthropic.apiKey') ?? '';
    return new Anthropic({ apiKey: apiKey || 'not-configured' });
  },
};
