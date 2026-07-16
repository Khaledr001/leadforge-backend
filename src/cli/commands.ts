import { Command, CommandRunner, Option } from 'nest-commander';
import { ScraperService } from '../scraper/scraper.service';
import { ScraperMode } from '../scraper/interfaces/scraper-provider.interface';
import { EnricherService } from '../enricher/enricher.service';
import { SitesService } from '../sites/sites.service';
import { OutreachService } from '../outreach/outreach.service';

interface ScrapeOptions {
  query: string;
  max: number;
  mode: ScraperMode;
}

@Command({ name: 'scrape', description: 'Scrape leads from Google Places or Outscraper' })
export class ScrapeCommand extends CommandRunner {
  constructor(private readonly scraper: ScraperService) {
    super();
  }

  async run(_args: string[], options: ScrapeOptions): Promise<void> {
    const summary = await this.scraper.scrape(options.query, options.max, options.mode);
    console.table(summary);
  }

  @Option({ flags: '--query <query>', description: 'Search query, e.g. "plumbers in Austin TX"', required: true })
  parseQuery(value: string): string {
    return value;
  }

  @Option({ flags: '--max <n>', description: 'Maximum results (default 20)', defaultValue: 20 })
  parseMax(value: string): number {
    return parseInt(value, 10);
  }

  @Option({ flags: '--mode <mode>', description: 'api | outscraper (default api)', defaultValue: 'api' })
  parseMode(value: string): string {
    return value;
  }
}

interface FilterOptions {
  city?: string;
  category?: string;
  limit?: number;
}

@Command({ name: 'enrich', description: 'Enrich NEW leads matching filters' })
export class EnrichCommand extends CommandRunner {
  constructor(private readonly enricher: EnricherService) {
    super();
  }

  async run(_args: string[], options: FilterOptions): Promise<void> {
    const summary = await this.enricher.enrichBatch(options);
    console.table(summary);
  }

  @Option({ flags: '--city <city>', description: 'Filter by city' })
  parseCity(value: string): string {
    return value;
  }

  @Option({ flags: '--category <category>', description: 'Filter by category' })
  parseCategory(value: string): string {
    return value;
  }

  @Option({ flags: '--limit <n>', description: 'Max leads to enrich' })
  parseLimit(value: string): number {
    return parseInt(value, 10);
  }
}

interface LeadIdOptions {
  leadId: string;
}

@Command({ name: 'generate-site', description: 'Generate + deploy a site for one lead' })
export class GenerateSiteCommand extends CommandRunner {
  constructor(private readonly sites: SitesService) {
    super();
  }

  async run(_args: string[], options: LeadIdOptions): Promise<void> {
    const site = await this.sites.createAndDeploy(options.leadId);
    console.table({
      id: site.id,
      subdomain: site.subdomain,
      templateId: site.templateId,
      deployUrl: site.deployUrl ?? '(not deployed)',
    });
  }

  @Option({ flags: '--lead-id <uuid>', description: 'Lead id', required: true })
  parseLeadId(value: string): string {
    return value;
  }
}

@Command({ name: 'generate-sites', description: 'Generate sites for leads matching filters' })
export class GenerateSitesCommand extends CommandRunner {
  constructor(private readonly sites: SitesService) {
    super();
  }

  async run(_args: string[], options: FilterOptions): Promise<void> {
    const summary = await this.sites.batchGenerate(options);
    console.table({
      matched: summary.matched,
      generated: summary.generated,
      failed: summary.failed,
    });
    for (const site of summary.sites) {
      console.log(` - ${site.subdomain} -> ${site.deployUrl ?? '(not deployed)'}`);
    }
  }

  @Option({ flags: '--city <city>', description: 'Filter by city' })
  parseCity(value: string): string {
    return value;
  }

  @Option({ flags: '--category <category>', description: 'Filter by category' })
  parseCategory(value: string): string {
    return value;
  }

  @Option({ flags: '--limit <n>', description: 'Max sites to generate' })
  parseLimit(value: string): number {
    return parseInt(value, 10);
  }
}

interface StartOutreachOptions extends FilterOptions {
  leadId?: string;
}

@Command({ name: 'start-outreach', description: 'Start email sequences for leads' })
export class StartOutreachCommand extends CommandRunner {
  constructor(private readonly outreach: OutreachService) {
    super();
  }

  async run(_args: string[], options: StartOutreachOptions): Promise<void> {
    if (options.leadId) {
      const result = await this.outreach.startSequence(options.leadId);
      console.table(result);
      return;
    }
    const summary = await this.outreach.startBatch(options);
    console.table(summary);
  }

  @Option({ flags: '--lead-id <uuid>', description: 'Start a single lead sequence' })
  parseLeadId(value: string): string {
    return value;
  }

  @Option({ flags: '--city <city>', description: 'Filter by city' })
  parseCity(value: string): string {
    return value;
  }

  @Option({ flags: '--category <category>', description: 'Filter by category' })
  parseCategory(value: string): string {
    return value;
  }

  @Option({ flags: '--limit <n>', description: 'Max sequences to start' })
  parseLimit(value: string): number {
    return parseInt(value, 10);
  }
}

@Command({ name: 'outreach-stats', description: 'Show outreach campaign statistics' })
export class OutreachStatsCommand extends CommandRunner {
  constructor(private readonly outreach: OutreachService) {
    super();
  }

  async run(): Promise<void> {
    const stats = await this.outreach.getStats();
    console.table(stats);
  }
}
