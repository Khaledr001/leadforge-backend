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

interface GoogleLatLng {
  lat: number;
  lng: number;
}

interface GooglePlacesSearchResult {
  place_id: string;
  name: string;
  formatted_address?: string;
  geometry?: { location?: GoogleLatLng };
  rating?: number;
  user_ratings_total?: number;
  types?: string[];
}

interface GooglePlacesSearchResponse {
  status: string;
  error_message?: string;
  results?: GooglePlacesSearchResult[];
  next_page_token?: string;
}

interface GoogleAddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

interface GooglePlaceDetailsResult {
  name?: string;
  formatted_phone_number?: string;
  international_phone_number?: string;
  website?: string;
  formatted_address?: string;
  address_components?: GoogleAddressComponent[];
  geometry?: { location?: GoogleLatLng };
  rating?: number;
  user_ratings_total?: number;
}

interface GooglePlaceDetailsResponse {
  status: string;
  error_message?: string;
  result?: GooglePlaceDetailsResult;
}

const GENERIC_TYPES = new Set([
  'point_of_interest',
  'establishment',
  'food',
  'store',
  'health',
  'finance',
]);

const SEARCH_URL = 'https://maps.googleapis.com/maps/api/place/textsearch/json';
const DETAILS_URL = 'https://maps.googleapis.com/maps/api/place/details/json';
const DETAILS_FIELDS =
  'name,formatted_phone_number,international_phone_number,website,formatted_address,address_component,geometry,rating,user_ratings_total';

@Injectable()
export class GooglePlacesProvider implements IScraperProvider {
  readonly name = 'google-places';
  private readonly logger = new Logger(GooglePlacesProvider.name);
  private readonly apiKey: string;
  private apiCallCount = 0;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('google.placesApiKey') ?? '';
  }

  async scrape(query: string, maxResults: number): Promise<RawLeadData[]> {
    if (!this.apiKey) {
      throw new ServiceUnavailableException(
        'GOOGLE_PLACES_API_KEY is not configured',
      );
    }

    this.apiCallCount = 0;
    const results: RawLeadData[] = [];
    let pageToken: string | undefined;

    do {
      const page = await this.textSearch(query, pageToken);
      for (const place of page.results ?? []) {
        if (results.length >= maxResults) break;
        const details = await this.placeDetails(place.place_id);
        results.push(this.map(place, details));
      }

      pageToken =
        results.length < maxResults ? page.next_page_token : undefined;
      // A freshly issued next_page_token needs a short delay before it is valid.
      if (pageToken) {
        await this.delay(2000);
      }
    } while (pageToken);

    this.logger.log(
      `Google Places "${query}": ${results.length} leads via ${this.apiCallCount} API calls`,
    );
    return results.slice(0, maxResults);
  }

  private async textSearch(
    query: string,
    pageToken?: string,
  ): Promise<GooglePlacesSearchResponse> {
    const url = new URL(SEARCH_URL);
    url.searchParams.set('query', query);
    url.searchParams.set('key', this.apiKey);
    if (pageToken) url.searchParams.set('pagetoken', pageToken);

    this.apiCallCount += 1;
    const res = await fetch(url);
    const data = (await res.json()) as GooglePlacesSearchResponse;
    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      throw new BadGatewayException(
        `Google Places text search failed: ${data.status} ${data.error_message ?? ''}`.trim(),
      );
    }
    return data;
  }

  private async placeDetails(
    placeId: string,
  ): Promise<GooglePlaceDetailsResult | undefined> {
    const url = new URL(DETAILS_URL);
    url.searchParams.set('place_id', placeId);
    url.searchParams.set('fields', DETAILS_FIELDS);
    url.searchParams.set('key', this.apiKey);

    this.apiCallCount += 1;
    const res = await fetch(url);
    const data = (await res.json()) as GooglePlaceDetailsResponse;
    if (data.status !== 'OK') {
      this.logger.warn(
        `Place details failed for ${placeId}: ${data.status} ${data.error_message ?? ''}`.trim(),
      );
      return undefined;
    }
    return data.result;
  }

  private map(
    search: GooglePlacesSearchResult,
    details?: GooglePlaceDetailsResult,
  ): RawLeadData {
    const components = details?.address_components ?? [];
    const component = (type: string): GoogleAddressComponent | undefined =>
      components.find((c) => c.types.includes(type));

    const location = details?.geometry?.location ?? search.geometry?.location;
    const category = (search.types ?? []).find((t) => !GENERIC_TYPES.has(t));

    return {
      businessName: details?.name ?? search.name,
      category,
      phone: details?.formatted_phone_number ?? details?.international_phone_number,
      address: details?.formatted_address ?? search.formatted_address,
      city:
        component('locality')?.long_name ??
        component('postal_town')?.long_name ??
        component('administrative_area_level_2')?.long_name,
      state: component('administrative_area_level_1')?.short_name,
      zip: component('postal_code')?.long_name,
      country: component('country')?.short_name ?? 'US',
      latitude: location?.lat,
      longitude: location?.lng,
      googlePlaceId: search.place_id,
      googleRating: details?.rating ?? search.rating,
      googleReviewCount: details?.user_ratings_total ?? search.user_ratings_total,
      websiteUrl: details?.website,
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
