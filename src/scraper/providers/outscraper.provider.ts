import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IScraperProvider,
  RawLeadData,
} from '../interfaces/scraper-provider.interface';

interface OutscraperPlace {
  name?: string;
  full_address?: string;
  city?: string;
  state?: string;
  us_state?: string;
  postal_code?: string;
  phone?: string;
  site?: string;
  latitude?: number;
  longitude?: number;
  place_id?: string;
  google_id?: string;
  rating?: number;
  reviews?: number;
  category?: string;
  type?: string;
  email_1?: string;
  facebook?: string;
}

interface OutscraperResponse {
  status?: string;
  data?: OutscraperPlace[][];
}

const SEARCH_URL = 'https://api.app.outscraper.com/maps/search-v3';

@Injectable()
export class OutscraperProvider implements IScraperProvider {
  readonly name = 'outscraper';
  private readonly logger = new Logger(OutscraperProvider.name);
  private readonly apiKey: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('outscraper.apiKey') ?? '';
  }

  async scrape(query: string, maxResults: number): Promise<RawLeadData[]> {
    if (!this.apiKey) {
      throw new ServiceUnavailableException(
        'OUTSCRAPER_API_KEY is not configured',
      );
    }

    const url = new URL(SEARCH_URL);
    url.searchParams.set('query', query);
    url.searchParams.set('limit', String(maxResults));
    url.searchParams.set('async', 'false');

    const res = await fetch(url, { headers: { 'X-API-KEY': this.apiKey } });
    if (!res.ok) {
      throw new BadGatewayException(
        `Outscraper request failed with status ${res.status}`,
      );
    }

    const data = (await res.json()) as OutscraperResponse;
    const places = data.data?.[0] ?? [];
    const leads = places
      .filter((p): p is OutscraperPlace & { name: string } => Boolean(p.name))
      .map((p) => this.map(p))
      .slice(0, maxResults);

    this.logger.log(`Outscraper "${query}": ${leads.length} leads`);
    return leads;
  }

  private map(p: OutscraperPlace & { name: string }): RawLeadData {
    return {
      businessName: p.name,
      category: p.category ?? p.type,
      phone: p.phone,
      email: p.email_1,
      address: p.full_address,
      city: p.city,
      state: p.us_state ?? p.state,
      zip: p.postal_code,
      country: 'US',
      latitude: p.latitude,
      longitude: p.longitude,
      googlePlaceId: p.place_id ?? p.google_id,
      googleRating: p.rating,
      googleReviewCount: p.reviews,
      websiteUrl: p.site,
      facebookUrl: p.facebook,
    };
  }
}
