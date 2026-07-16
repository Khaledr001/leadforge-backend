import { Injectable } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import * as Handlebars from 'handlebars';
import { SequenceStep } from './constants/sequence';

export interface BuildEmailParams {
  step: SequenceStep;
  stepId: string;
  businessName: string;
  city: string | null;
  leadId: string;
  siteUrl: string;
  apiUrl: string;
  unsubscribeUrl: string;
  senderName: string;
  physicalAddress: string;
}

export interface BuiltEmail {
  subject: string;
  html: string;
  text: string;
}

@Injectable()
export class EmailBuilder {
  private readonly templatesDir = path.join(__dirname, 'templates');
  private readonly cache = new Map<string, Handlebars.TemplateDelegate>();

  buildEmail(params: BuildEmailParams): BuiltEmail {
    const context = {
      businessName: params.businessName,
      city: params.city ?? '',
      siteUrl: params.siteUrl,
      senderName: params.senderName,
    };

    const subject = Handlebars.compile(params.step.subject)(context);
    const body = this.template(params.step.template)(context);
    const trackedBody = this.wrapLinks(body, params.apiUrl, params.stepId);

    const pixelUrl = `${params.apiUrl}/analytics/pixel/${params.leadId}.gif`;
    const html = this.layout(trackedBody, params, pixelUrl);
    const text = this.toText(body, params);

    return { subject, html, text };
  }

  private template(name: string): Handlebars.TemplateDelegate {
    const cached = this.cache.get(name);
    if (cached) return cached;
    const source = readFileSync(path.join(this.templatesDir, `${name}.hbs`), 'utf8');
    const compiled = Handlebars.compile(source);
    this.cache.set(name, compiled);
    return compiled;
  }

  /** Rewrites body links through the click-tracking redirect. */
  private wrapLinks(html: string, apiUrl: string, stepId: string): string {
    return html.replace(
      /href="(https?:\/\/[^"]+)"/g,
      (_match, url: string) =>
        `href="${apiUrl}/analytics/click/${stepId}/${encodeURIComponent(url)}"`,
    );
  }

  private layout(body: string, params: BuildEmailParams, pixelUrl: string): string {
    return `<!doctype html>
<html lang="en">
<body style="margin:0;padding:0;background:#f4f4f5;">
  <div style="max-width:560px;margin:0 auto;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#222;line-height:1.6;">
    ${body}
    <hr style="border:none;border-top:1px solid #e5e5e5;margin:28px 0;">
    <p style="font-size:12px;color:#888;">
      ${params.senderName} &middot; ${params.physicalAddress}<br>
      <a href="${params.unsubscribeUrl}" style="color:#888;">Unsubscribe</a>
    </p>
  </div>
  <img src="${pixelUrl}" width="1" height="1" alt="" style="display:none;border:0;">
</body>
</html>`;
  }

  private toText(body: string, params: BuildEmailParams): string {
    const stripped = body
      .replace(/<[^>]+>/g, ' ')
      .replace(/&middot;/g, '·')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{2,}/g, '\n\n')
      .trim();
    return `${stripped}\n\n---\n${params.senderName}\n${params.physicalAddress}\nUnsubscribe: ${params.unsubscribeUrl}`;
  }
}
