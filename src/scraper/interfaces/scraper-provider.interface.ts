/** Normalized lead shape every scraper provider maps its response into. */
export interface RawLeadData {
  businessName: string;
  category?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  googlePlaceId?: string;
  googleRating?: number;
  googleReviewCount?: number;
  websiteUrl?: string;
  facebookUrl?: string;
}

/** Strategy interface implemented by each scraper provider. */
export interface IScraperProvider {
  readonly name: string;
  scrape(query: string, maxResults: number): Promise<RawLeadData[]>;
}

export type ScraperMode = 'api' | 'outscraper';

/** DI token for the map of scraper providers keyed by mode. */
export const SCRAPER_PROVIDERS = Symbol('SCRAPER_PROVIDERS');

export interface ScrapeSummary {
  found: number;
  new: number;
  withoutWebsite: number;
  duplicatesSkipped: number;
}
