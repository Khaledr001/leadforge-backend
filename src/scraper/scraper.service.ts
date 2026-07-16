import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { LeadStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import {
  IScraperProvider,
  RawLeadData,
  SCRAPER_PROVIDERS,
  ScraperMode,
  ScrapeSummary,
} from './interfaces/scraper-provider.interface';

@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(SCRAPER_PROVIDERS)
    private readonly providers: Record<ScraperMode, IScraperProvider>,
  ) {}

  async scrape(
    query: string,
    maxResults = 20,
    mode: ScraperMode = 'api',
  ): Promise<ScrapeSummary> {
    const provider = this.providers[mode];
    if (!provider) {
      throw new BadRequestException(`Unknown scraper mode: ${mode}`);
    }

    const raw = await provider.scrape(query, maxResults);
    const found = raw.length;

    const toInsert = await this.dedupe(raw);
    const inserted = await this.bulkInsert(toInsert);
    const withoutWebsite = toInsert.filter((r) => !r.websiteUrl).length;
    const duplicatesSkipped = found - toInsert.length;

    const summary: ScrapeSummary = {
      found,
      new: inserted,
      withoutWebsite,
      duplicatesSkipped,
    };
    this.logger.log(
      `Scrape "${query}" [${mode}] → ${JSON.stringify(summary)}`,
    );
    return summary;
  }

  /** Removes leads already in the DB (by googlePlaceId) and in-batch duplicates. */
  private async dedupe(raw: RawLeadData[]): Promise<RawLeadData[]> {
    const placeIds = raw
      .map((r) => r.googlePlaceId)
      .filter((id): id is string => Boolean(id));

    const existing = placeIds.length
      ? await this.prisma.lead.findMany({
          where: { googlePlaceId: { in: placeIds } },
          select: { googlePlaceId: true },
        })
      : [];
    const existingIds = new Set(existing.map((e) => e.googlePlaceId));

    const seen = new Set<string>();
    return raw.filter((r) => {
      if (!r.googlePlaceId) return true; // cannot dedupe without an id
      if (existingIds.has(r.googlePlaceId) || seen.has(r.googlePlaceId)) {
        return false;
      }
      seen.add(r.googlePlaceId);
      return true;
    });
  }

  private async bulkInsert(leads: RawLeadData[]): Promise<number> {
    if (leads.length === 0) return 0;
    const data: Prisma.LeadCreateManyInput[] = leads.map((r) => ({
      ...r,
      status: LeadStatus.NEW,
    }));
    const result = await this.prisma.lead.createMany({
      data,
      skipDuplicates: true,
    });
    return result.count;
  }
}
