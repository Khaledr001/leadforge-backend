import { SocialPlatform } from '@prisma/client';

/** Business context distilled from a Lead/Client for prompt building. */
export interface BusinessContext {
  businessName: string;
  category?: string | null;
  city?: string | null;
  state?: string | null;
  googleRating?: number | null;
  googleReviewCount?: number | null;
  description?: string | null;
}

export interface WebsiteCopyService {
  name: string;
  description: string;
}

export interface WebsiteTestimonial {
  text: string;
  author: string;
}

export interface WebsiteCopy {
  heroHeadline: string;
  heroSubheadline: string;
  aboutSection: string;
  services: WebsiteCopyService[];
  testimonials: WebsiteTestimonial[];
  ctaText: string;
  metaTitle: string;
  metaDescription: string;
  seoKeywords: string[];
}

export interface GeneratedSocialPost {
  content: string;
  platform: SocialPlatform;
  imagePrompt: string;
}

export type GbpPriority = 'HIGH' | 'MEDIUM' | 'LOW';

export interface GbpRecommendation {
  title: string;
  recommendation: string;
  priority: GbpPriority;
}

export interface GBPReport {
  businessName: string;
  category: string | null;
  summary: string;
  recommendations: GbpRecommendation[];
}
