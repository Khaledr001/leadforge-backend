import { BusinessContext } from '../interfaces/ai-copy.types';
import { PromptMessages } from './website-copy.prompt';

/** Builds the system + user messages for Google Business Profile suggestions. */
export function gbpSuggestionsPrompt(ctx: BusinessContext): PromptMessages {
  const system = [
    'You are a local SEO consultant specializing in Google Business Profile optimization.',
    'You give concrete, actionable recommendations tailored to the business category.',
    'Respond with ONLY valid JSON — no markdown, no code fences, no commentary.',
  ].join(' ');

  const location = [ctx.city, ctx.state].filter(Boolean).join(', ') || 'the local area';
  const reputation =
    ctx.googleRating != null
      ? `${ctx.googleRating}★ from ${ctx.googleReviewCount ?? 'unknown number of'} reviews`
      : 'no rating data available';

  const user = `Analyze this business and produce Google Business Profile optimization recommendations.

Business name: ${ctx.businessName}
Category: ${ctx.category ?? 'local service business'}
Location: ${location}
Current reputation: ${reputation}

Return a JSON object with exactly these keys:
{
  "summary": string (2-3 sentence overview of the biggest opportunities),
  "recommendations": array of 5-8 objects, each:
    {
      "title": string (short label),
      "recommendation": string (specific, actionable advice),
      "priority": one of "HIGH", "MEDIUM", "LOW"
    }
}`;

  return { system, user };
}
