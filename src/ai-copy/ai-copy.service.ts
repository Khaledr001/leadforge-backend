import {
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Lead, SocialPlatform } from '@prisma/client';
import Anthropic from '@anthropic-ai/sdk';
import { Semaphore } from '../common/utils/semaphore';
import { ANTHROPIC_CLIENT } from './anthropic.provider';
import {
  BusinessContext,
  GBPReport,
  GeneratedSocialPost,
  WebsiteCopy,
} from './interfaces/ai-copy.types';
import { PromptMessages, websiteCopyPrompt } from './prompts/website-copy.prompt';
import { socialPostsPrompt } from './prompts/social-post.prompt';
import { gbpSuggestionsPrompt } from './prompts/gbp-suggestions.prompt';
import {
  isGbpReport,
  isSocialPostsPayload,
  isWebsiteCopy,
} from './ai-copy.validators';

const MAX_ATTEMPTS = 3;
const MAX_TOKENS = 8192;
const MAX_CONCURRENCY = 10;

@Injectable()
export class AiCopyService {
  private readonly logger = new Logger(AiCopyService.name);
  private readonly model: string;
  private readonly apiKeyConfigured: boolean;
  private readonly limiter = new Semaphore(MAX_CONCURRENCY);

  constructor(
    @Inject(ANTHROPIC_CLIENT) private readonly anthropic: Anthropic,
    private readonly config: ConfigService,
  ) {
    this.model = this.config.get<string>('anthropic.model') ?? 'claude-sonnet-5';
    this.apiKeyConfigured = Boolean(this.config.get<string>('anthropic.apiKey'));
  }

  async generateWebsiteCopy(lead: Lead): Promise<WebsiteCopy> {
    this.ensureConfigured();
    const prompt = websiteCopyPrompt(this.toContext(lead));
    return this.limiter.run(() =>
      this.generate(prompt, isWebsiteCopy, 'website copy'),
    );
  }

  async generateSocialPosts(
    context: BusinessContext,
    count: number,
    platform: SocialPlatform,
  ): Promise<GeneratedSocialPost[]> {
    this.ensureConfigured();
    const safeCount = Math.min(Math.max(count, 1), 30);
    const prompt = socialPostsPrompt(context, safeCount, platform);
    const payload = await this.limiter.run(() =>
      this.generate(prompt, isSocialPostsPayload, 'social posts'),
    );
    return payload.posts.map((p) => ({
      content: p.content,
      imagePrompt: p.imagePrompt,
      platform,
    }));
  }

  async generateGBPSuggestions(context: BusinessContext): Promise<GBPReport> {
    this.ensureConfigured();
    const prompt = gbpSuggestionsPrompt(context);
    const report = await this.limiter.run(() =>
      this.generate(prompt, isGbpReport, 'GBP suggestions'),
    );
    return {
      businessName: context.businessName,
      category: context.category ?? null,
      summary: report.summary,
      recommendations: report.recommendations,
    };
  }

  /** Calls Claude, extracts + parses + validates JSON, retrying up to 3 times. */
  private async generate<T>(
    prompt: PromptMessages,
    validate: (value: unknown) => value is T,
    label: string,
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
        const response = await this.anthropic.messages.create({
          model: this.model,
          max_tokens: MAX_TOKENS,
          system: prompt.system,
          messages: [{ role: 'user', content: prompt.user }],
        });

        if (response.stop_reason === 'refusal') {
          throw new Error('model refused the request');
        }

        const parsed: unknown = JSON.parse(this.extractJson(response));
        if (!validate(parsed)) {
          throw new Error('response failed shape validation');
        }
        return parsed;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        this.logger.warn(
          `${label} generation attempt ${attempt}/${MAX_ATTEMPTS} failed: ${lastError.message}`,
        );
      }
    }

    throw new ServiceUnavailableException(
      `Failed to generate ${label} after ${MAX_ATTEMPTS} attempts: ${lastError?.message ?? 'unknown error'}`,
    );
  }

  private extractJson(message: Anthropic.Message): string {
    const textBlock = message.content.find(
      (block): block is Anthropic.TextBlock => block.type === 'text',
    );
    if (!textBlock) {
      throw new Error('no text block in response');
    }

    let text = textBlock.text.trim();
    const fenced = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
    if (fenced) {
      text = fenced[1].trim();
    }
    // Extract the outermost JSON object even if surrounded by stray prose.
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      return text.slice(start, end + 1);
    }
    return text;
  }

  private ensureConfigured(): void {
    if (!this.apiKeyConfigured) {
      throw new ServiceUnavailableException('ANTHROPIC_API_KEY is not configured');
    }
  }

  private toContext(lead: Lead): BusinessContext {
    return {
      businessName: lead.businessName,
      category: lead.category,
      city: lead.city,
      state: lead.state,
      googleRating: lead.googleRating == null ? null : Number(lead.googleRating),
      googleReviewCount: lead.googleReviewCount,
      description: null,
    };
  }
}
