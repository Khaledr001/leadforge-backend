import { Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';

export interface FacebookEnrichment {
  email?: string;
  phone?: string;
  hours?: string;
  description?: string;
}

const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const PHONE_RE = /(\+?\d[\d\s().-]{7,}\d)/;

/**
 * Best-effort enrichment from a public Facebook page's About section.
 * Facebook heavily restricts scraping (login walls, JS-rendered content), so a
 * plain HTTP GET often yields limited data — the Graph API is the robust path.
 * Returns whatever can be parsed, or null.
 */
@Injectable()
export class FacebookProvider {
  private readonly logger = new Logger(FacebookProvider.name);

  async enrich(facebookUrl: string): Promise<FacebookEnrichment | null> {
    const url = this.toAboutUrl(facebookUrl);
    try {
      const res = await fetch(url, {
        headers: BROWSER_HEADERS,
        redirect: 'follow',
      });
      if (!res.ok) {
        this.logger.warn(`Facebook fetch ${url} -> HTTP ${res.status}`);
        return null;
      }
      return this.parse(await res.text());
    } catch (err) {
      this.logger.warn(
        `Facebook fetch failed for ${url}: ${(err as Error).message}`,
      );
      return null;
    }
  }

  private parse(html: string): FacebookEnrichment | null {
    const $ = cheerio.load(html);
    const result: FacebookEnrichment = {};

    const description =
      $('meta[property="og:description"]').attr('content') ??
      $('meta[name="description"]').attr('content');
    if (description) result.description = description.trim();

    const mailto = $('a[href^="mailto:"]').first().attr('href');
    const tel = $('a[href^="tel:"]').first().attr('href');
    const bodyText = $('body').text();

    const email = mailto
      ? mailto.replace('mailto:', '').split('?')[0]
      : bodyText.match(EMAIL_RE)?.[0];
    if (email) result.email = email.toLowerCase();

    const phone = tel
      ? tel.replace('tel:', '')
      : bodyText.match(PHONE_RE)?.[0]?.trim();
    if (phone) result.phone = phone;

    const hours = html.match(/"hours"\s*:\s*"([^"]+)"/i)?.[1];
    if (hours) result.hours = hours;

    return Object.keys(result).length > 0 ? result : null;
  }

  private toAboutUrl(url: string): string {
    const trimmed = url.replace(/\/+$/, '');
    return /\/about$/i.test(trimmed) ? trimmed : `${trimmed}/about`;
  }
}
