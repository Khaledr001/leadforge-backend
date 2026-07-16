import { Controller, Get, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AnalyticsService } from './analytics.service';
import { Public } from '../common/decorators/public.decorator';
import { SkipTransform } from '../common/decorators/skip-transform.decorator';

// 1x1 transparent GIF.
const PIXEL_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
);

@Controller('analytics')
export class TrackingPixelController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Public()
  @SkipTransform()
  @Get('pixel/:leadId')
  async pixel(@Param('leadId') leadIdParam: string, @Res() res: Response): Promise<void> {
    const leadId = leadIdParam.replace(/\.gif$/i, '');
    await this.analytics.recordEmailOpen(leadId).catch(() => undefined);
    res.set({
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      Pragma: 'no-cache',
      Expires: '0',
    });
    res.status(200).send(PIXEL_GIF);
  }

  @Public()
  @SkipTransform()
  @Get('click/:stepId/:url')
  async click(
    @Param('stepId') stepId: string,
    @Param('url') url: string,
    @Res() res: Response,
  ): Promise<void> {
    const target = decodeURIComponent(url);
    await this.analytics.recordEmailClick(stepId, target).catch(() => undefined);
    res.redirect(302, target);
  }
}
