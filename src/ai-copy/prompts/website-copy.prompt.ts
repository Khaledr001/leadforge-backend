import { BusinessContext } from '../interfaces/ai-copy.types';

export interface PromptMessages {
  system: string;
  user: string;
}

/** Builds the system + user messages for website copy generation. */
export function websiteCopyPrompt(ctx: BusinessContext): PromptMessages {
  const system = [
    'You are an expert conversion copywriter for small local service businesses.',
    'You write warm, trustworthy, locally relevant website copy that drives phone calls.',
    'Respond with ONLY valid JSON matching the requested structure — no markdown,',
    'no code fences, no commentary before or after the JSON.',
  ].join(' ');

  const location = [ctx.city, ctx.state].filter(Boolean).join(', ') || 'the local area';
  const reputation =
    ctx.googleRating != null
      ? `${ctx.googleRating}★ from ${ctx.googleReviewCount ?? 'many'} Google reviews`
      : 'a solid local reputation';

  const user = `Write website copy for this business.

Business name: ${ctx.businessName}
Category: ${ctx.category ?? 'local service business'}
Location: ${location}
Reputation: ${reputation}${ctx.description ? `\nAbout: ${ctx.description}` : ''}

Return a JSON object with exactly these keys:
{
  "heroHeadline": string (punchy, <= 60 characters),
  "heroSubheadline": string (one supporting sentence),
  "aboutSection": string (2-3 short paragraphs, separated by \\n\\n),
  "services": array of 4-6 { "name": string, "description": string (one sentence) },
  "testimonials": array of 3 generic sample { "text": string, "author": string } (clearly placeholder review copy),
  "ctaText": string (short call to action, e.g. "Call now for a free quote"),
  "metaTitle": string (<= 60 characters, include the business name and city),
  "metaDescription": string (<= 155 characters),
  "seoKeywords": array of 6-10 local SEO keyword strings
}`;

  return { system, user };
}
