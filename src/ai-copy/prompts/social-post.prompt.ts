import { SocialPlatform } from '@prisma/client';
import { BusinessContext } from '../interfaces/ai-copy.types';
import { PromptMessages } from './website-copy.prompt';

/** Builds the system + user messages for social media post generation. */
export function socialPostsPrompt(
  ctx: BusinessContext,
  count: number,
  platform: SocialPlatform,
): PromptMessages {
  const system = [
    'You are a social media manager for small local businesses.',
    'You write short, engaging, platform-appropriate posts that build trust and local presence.',
    'Respond with ONLY valid JSON — no markdown, no code fences, no commentary.',
  ].join(' ');

  const location = [ctx.city, ctx.state].filter(Boolean).join(', ') || 'the local area';

  const user = `Generate ${count} ${platform} posts for this business.

Business name: ${ctx.businessName}
Category: ${ctx.category ?? 'local service business'}
Location: ${location}

Vary the post types across the set: helpful tips, promotions/offers, community/local
engagement, and seasonal themes. Keep each post concise and platform-appropriate for
${platform}. Include relevant hashtags where natural.

Return a JSON object with exactly this structure:
{
  "posts": array of ${count} objects, each:
    {
      "content": string (the post text, including any hashtags),
      "imagePrompt": string (a short prompt describing an image to accompany the post)
    }
}`;

  return { system, user };
}
