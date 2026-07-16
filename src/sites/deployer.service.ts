import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const DEPLOY_TIMEOUT_MS = 180_000;

export interface DeployResult {
  deployUrl: string | null;
  deployed: boolean;
}

/**
 * Deploys built static sites to Cloudflare Pages via the Wrangler CLI.
 * Degrades gracefully: when Cloudflare credentials are absent (local dev), the
 * site is generated and recorded but not uploaded (deployUrl = null).
 */
@Injectable()
export class DeployerService {
  private readonly logger = new Logger(DeployerService.name);
  private readonly apiToken: string;
  private readonly accountId: string;
  private readonly baseDomain: string;
  private readonly configured: boolean;

  constructor(private readonly config: ConfigService) {
    this.apiToken = this.config.get<string>('cloudflare.apiToken') ?? '';
    this.accountId = this.config.get<string>('cloudflare.accountId') ?? '';
    this.baseDomain = this.config.get<string>('cloudflare.baseDomain') ?? 'example.com';
    this.configured = Boolean(this.apiToken && this.accountId);
  }

  async deploySite(buildPath: string, subdomain: string): Promise<DeployResult> {
    if (!this.configured) {
      this.logger.warn(
        `Cloudflare not configured — built ${subdomain} at ${buildPath} but skipping deploy`,
      );
      return { deployUrl: null, deployed: false };
    }

    const projectName = this.projectName(subdomain);
    try {
      await this.wrangler([
        'pages',
        'deploy',
        buildPath,
        `--project-name=${projectName}`,
        '--branch=main',
      ]);
      const deployUrl = `https://${subdomain}.${this.baseDomain}`;
      this.logger.log(`Deployed ${subdomain} -> ${deployUrl}`);
      return { deployUrl, deployed: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Deploy failed for ${subdomain}: ${message}`);
      return { deployUrl: null, deployed: false };
    }
  }

  async teardownSite(subdomain: string): Promise<void> {
    if (!this.configured) {
      this.logger.warn(`Cloudflare not configured — nothing to tear down for ${subdomain}`);
      return;
    }
    try {
      await this.wrangler(['pages', 'project', 'delete', this.projectName(subdomain), '--yes']);
      this.logger.log(`Tore down Cloudflare Pages project for ${subdomain}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Teardown failed for ${subdomain}: ${message}`);
    }
  }

  private projectName(subdomain: string): string {
    // Cloudflare Pages project names: lowercase, <= 58 chars.
    return `leadforge-${subdomain}`.slice(0, 58);
  }

  private async wrangler(args: string[]): Promise<void> {
    await execFileAsync('npx', ['--yes', 'wrangler', ...args], {
      timeout: DEPLOY_TIMEOUT_MS,
      maxBuffer: 10 * 1024 * 1024,
      env: {
        ...process.env,
        CLOUDFLARE_API_TOKEN: this.apiToken,
        CLOUDFLARE_ACCOUNT_ID: this.accountId,
      },
    });
  }
}
