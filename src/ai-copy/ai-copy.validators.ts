import {
  GbpPriority,
  GBPReport,
  WebsiteCopy,
  WebsiteCopyService,
  WebsiteTestimonial,
} from './interfaces/ai-copy.types';

/** Raw social-posts payload as returned by the model (platform added later). */
export interface SocialPostsPayload {
  posts: { content: string; imagePrompt: string }[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

function isWebsiteService(value: unknown): value is WebsiteCopyService {
  return (
    isRecord(value) &&
    typeof value.name === 'string' &&
    typeof value.description === 'string'
  );
}

function isTestimonial(value: unknown): value is WebsiteTestimonial {
  return (
    isRecord(value) &&
    typeof value.text === 'string' &&
    typeof value.author === 'string'
  );
}

export function isWebsiteCopy(value: unknown): value is WebsiteCopy {
  if (!isRecord(value)) return false;
  return (
    typeof value.heroHeadline === 'string' &&
    typeof value.heroSubheadline === 'string' &&
    typeof value.aboutSection === 'string' &&
    Array.isArray(value.services) &&
    value.services.length > 0 &&
    value.services.every(isWebsiteService) &&
    Array.isArray(value.testimonials) &&
    value.testimonials.every(isTestimonial) &&
    typeof value.ctaText === 'string' &&
    typeof value.metaTitle === 'string' &&
    typeof value.metaDescription === 'string' &&
    isStringArray(value.seoKeywords)
  );
}

export function isSocialPostsPayload(value: unknown): value is SocialPostsPayload {
  if (!isRecord(value) || !Array.isArray(value.posts)) return false;
  return value.posts.every(
    (post) =>
      isRecord(post) &&
      typeof post.content === 'string' &&
      typeof post.imagePrompt === 'string',
  );
}

const PRIORITIES: readonly GbpPriority[] = ['HIGH', 'MEDIUM', 'LOW'];

function isGbpPriority(value: unknown): value is GbpPriority {
  return typeof value === 'string' && PRIORITIES.includes(value as GbpPriority);
}

export function isGbpReport(
  value: unknown,
): value is Pick<GBPReport, 'summary' | 'recommendations'> {
  if (!isRecord(value)) return false;
  return (
    typeof value.summary === 'string' &&
    Array.isArray(value.recommendations) &&
    value.recommendations.length > 0 &&
    value.recommendations.every(
      (rec) =>
        isRecord(rec) &&
        typeof rec.title === 'string' &&
        typeof rec.recommendation === 'string' &&
        isGbpPriority(rec.priority),
    )
  );
}
