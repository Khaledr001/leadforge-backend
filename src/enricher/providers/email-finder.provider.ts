import { Injectable, Logger } from '@nestjs/common';
import { MxCheckerProvider } from './mx-checker.provider';

/** Common mailbox local-parts, in best-guess priority order. */
const LOCAL_PARTS = ['info', 'contact', 'hello', 'admin', 'support'];

/**
 * Guesses a likely contact email for a domain using common patterns.
 * Only returns a guess when the domain has MX records (accepts mail); it does
 * NOT send verification emails, so the result is a best guess, not confirmed.
 */
@Injectable()
export class EmailFinderProvider {
  private readonly logger = new Logger(EmailFinderProvider.name);

  constructor(private readonly mxChecker: MxCheckerProvider) {}

  async findEmail(
    domainOrUrl: string,
    businessName?: string,
  ): Promise<string | null> {
    const domain = this.normalizeDomain(domainOrUrl);
    if (!domain) return null;

    const hasMx = await this.mxChecker.hasMxRecords(domain);
    if (!hasMx) {
      this.logger.debug(`No MX for ${domain}; cannot guess a deliverable email`);
      return null;
    }

    const [best] = this.buildCandidates(domain, businessName);
    return best ?? null;
  }

  /** All candidate emails in priority order (useful for future SMTP checks). */
  buildCandidates(domainOrUrl: string, businessName?: string): string[] {
    const domain = this.normalizeDomain(domainOrUrl);
    if (!domain) return [];

    const parts = [...LOCAL_PARTS];
    const slug = businessName ? this.slugifyLocalPart(businessName) : '';
    if (slug) parts.push(slug);

    return parts.map((p) => `${p}@${domain}`);
  }

  private normalizeDomain(input: string): string | null {
    let domain = input.trim().toLowerCase();
    if (!domain) return null;

    if (domain.includes('://')) {
      try {
        domain = new URL(domain).hostname;
      } catch {
        return null;
      }
    }
    domain = domain.replace(/^www\./, '').replace(/\/.*$/, '');

    return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain) ? domain : null;
  }

  private slugifyLocalPart(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '')
      .slice(0, 30);
  }
}
