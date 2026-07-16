import { Injectable, Logger } from '@nestjs/common';
import { resolveMx } from 'node:dns/promises';

interface CacheEntry {
  hasMx: boolean;
  expiresAt: number;
}

/**
 * Validates that a domain publishes MX records (i.e. can receive mail).
 * Results are cached in-memory with a TTL to avoid repeated DNS lookups.
 */
@Injectable()
export class MxCheckerProvider {
  private readonly logger = new Logger(MxCheckerProvider.name);
  private readonly cache = new Map<string, CacheEntry>();
  private readonly ttlMs = 60 * 60 * 1000; // 1 hour

  async hasMxRecords(domain: string): Promise<boolean> {
    const key = domain.trim().toLowerCase();
    if (!key) return false;

    const cached = this.cache.get(key);
    const now = Date.now();
    if (cached && cached.expiresAt > now) {
      return cached.hasMx;
    }

    let hasMx = false;
    try {
      const records = await resolveMx(key);
      hasMx = Array.isArray(records) && records.length > 0;
    } catch {
      // ENOTFOUND / ENODATA — no MX records or domain does not resolve.
      hasMx = false;
    }

    this.cache.set(key, { hasMx, expiresAt: now + this.ttlMs });
    return hasMx;
  }
}
