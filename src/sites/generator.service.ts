import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Lead } from '@prisma/client';
import { existsSync } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { PrismaService } from '../database/prisma.service';
import { AiCopyService } from '../ai-copy/ai-copy.service';
import { WebsiteCopy } from '../ai-copy/interfaces/ai-copy.types';
import { slugify } from '../common/utils/slugify';
import { resolveTemplate, TemplateId } from './constants/category-template.map';

const execFileAsync = promisify(execFile);
const BUILD_TIMEOUT_MS = 120_000;

export interface GeneratedSiteBuild {
  buildDir: string;
  buildPath: string;
  subdomain: string;
  templateId: TemplateId;
  generatedCopy: WebsiteCopy;
}

@Injectable()
export class GeneratorService {
  private readonly logger = new Logger(GeneratorService.name);
  private readonly templatesRoot: string;
  private readonly buildRoot = path.join(os.tmpdir(), 'leadforge-sites');

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiCopy: AiCopyService,
    private readonly config: ConfigService,
  ) {
    this.templatesRoot =
      this.config.get<string>('app.templatesDir') ??
      path.join(process.cwd(), 'templates');
  }

  async generateSite(leadId: string): Promise<GeneratedSiteBuild> {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) {
      throw new NotFoundException(`Lead ${leadId} not found`);
    }

    const templateId = resolveTemplate(lead.category);
    const templateDir = path.join(this.templatesRoot, templateId);
    if (!existsSync(templateDir)) {
      throw new ServiceUnavailableException(`Template ${templateId} not found at ${templateDir}`);
    }

    const generatedCopy = await this.aiCopy.generateWebsiteCopy(lead);
    const subdomain = await this.uniqueSubdomain(lead.businessName);

    const buildDir = path.join(this.buildRoot, `${subdomain}-${Date.now()}`);
    await this.copyTemplate(templateDir, buildDir);
    const data = await this.composeData(lead, generatedCopy, templateDir);
    await fs.writeFile(
      path.join(buildDir, 'src', 'data.json'),
      `${JSON.stringify(data, null, 2)}\n`,
    );
    await this.runAstroBuild(buildDir, templateDir);

    this.logger.log(`Generated site "${subdomain}" (${templateId}) for lead ${leadId}`);
    return {
      buildDir,
      buildPath: path.join(buildDir, 'dist'),
      subdomain,
      templateId,
      generatedCopy,
    };
  }

  /** Removes a temp build directory once the output has been deployed. */
  async cleanup(buildDir: string): Promise<void> {
    await fs.rm(buildDir, { recursive: true, force: true }).catch(() => undefined);
  }

  private async uniqueSubdomain(businessName: string): Promise<string> {
    const base = slugify(businessName);
    let candidate = base;
    let suffix = 1;
    while ((await this.prisma.generatedSite.count({ where: { subdomain: candidate } })) > 0) {
      suffix += 1;
      candidate = `${base}-${suffix}`;
    }
    return candidate;
  }

  private async copyTemplate(templateDir: string, buildDir: string): Promise<void> {
    await fs.mkdir(this.buildRoot, { recursive: true });
    await fs.cp(templateDir, buildDir, {
      recursive: true,
      filter: (source) => {
        const rel = path.relative(templateDir, source);
        return (
          !rel.startsWith('node_modules') &&
          !rel.startsWith('dist') &&
          !rel.startsWith('.astro')
        );
      },
    });
    // Share the template's installed dependencies via a symlink (no huge copy).
    await fs.symlink(
      path.join(templateDir, 'node_modules'),
      path.join(buildDir, 'node_modules'),
      'dir',
    );
  }

  private async composeData(
    lead: Lead,
    copy: WebsiteCopy,
    templateDir: string,
  ): Promise<Record<string, unknown>> {
    const base = JSON.parse(
      await fs.readFile(path.join(templateDir, 'src', 'data.json'), 'utf8'),
    ) as Record<string, unknown>;

    const mapQuery = encodeURIComponent(
      [lead.address, lead.city, lead.state].filter(Boolean).join(', ') ||
        lead.businessName,
    );

    return {
      businessName: lead.businessName,
      phone: lead.phone ?? '',
      address: lead.address ?? '',
      city: lead.city ?? '',
      state: lead.state ?? '',
      zip: lead.zip ?? '',
      heroHeadline: copy.heroHeadline,
      heroSubheadline: copy.heroSubheadline,
      aboutSection: copy.aboutSection,
      services: copy.services,
      testimonials: copy.testimonials,
      ctaText: copy.ctaText,
      metaTitle: copy.metaTitle,
      metaDescription: copy.metaDescription,
      seoKeywords: copy.seoKeywords,
      googleMapsEmbedUrl: `https://www.google.com/maps?q=${mapQuery}&output=embed`,
      primaryColor: base.primaryColor,
      accentColor: base.accentColor,
      fontFamily: base.fontFamily,
    };
  }

  private async runAstroBuild(buildDir: string, templateDir: string): Promise<void> {
    const astroBin = path.join(templateDir, 'node_modules', '.bin', 'astro');
    if (!existsSync(astroBin)) {
      throw new ServiceUnavailableException(
        `Template ${path.basename(templateDir)} has no dependencies installed — run "pnpm install --ignore-workspace" in ${templateDir}`,
      );
    }
    try {
      // .bin/astro is a shell shim; run it directly and make sure `node` is on
      // PATH (prepend the running node's directory) so the shim can find it.
      const nodeDir = path.dirname(process.execPath);
      await execFileAsync(astroBin, ['build'], {
        cwd: buildDir,
        timeout: BUILD_TIMEOUT_MS,
        maxBuffer: 10 * 1024 * 1024,
        env: {
          ...process.env,
          PATH: `${nodeDir}${path.delimiter}${process.env.PATH ?? ''}`,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new ServiceUnavailableException(`astro build failed: ${message}`);
    }
  }
}
