import { Body, Controller, Get, Param, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { OutreachService } from './outreach.service';
import { StartOutreachDto } from './dto/start-outreach.dto';
import { Public } from '../common/decorators/public.decorator';
import { SkipTransform } from '../common/decorators/skip-transform.decorator';

@Controller('outreach')
export class OutreachController {
  constructor(private readonly outreachService: OutreachService) {}

  @Post('start')
  start(@Body() dto: StartOutreachDto) {
    if (dto.leadId) {
      return this.outreachService.startSequence(dto.leadId);
    }
    return this.outreachService.startBatch({
      city: dto.city,
      category: dto.category,
      limit: dto.limit,
    });
  }

  @Post('pause')
  pause() {
    return this.outreachService.pause();
  }

  @Post('resume')
  resume() {
    return this.outreachService.resume();
  }

  @Get('stats')
  stats() {
    return this.outreachService.getStats();
  }

  @Get('sequences')
  sequences() {
    return this.outreachService.listSequences();
  }

  // Email-footer unsubscribe links are clicked (GET). Public + raw HTML response.
  @Public()
  @SkipTransform()
  @Get('unsubscribe/:token')
  async unsubscribe(@Param('token') token: string, @Res() res: Response): Promise<void> {
    let message = 'You have been unsubscribed.';
    try {
      const result = await this.outreachService.handleUnsubscribe(token);
      message = result.message;
    } catch {
      message = 'This unsubscribe link is invalid or has expired.';
    }
    res.status(200).type('html').send(
      `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Unsubscribe</title></head><body style="font-family:Arial,sans-serif;text-align:center;padding:60px 20px;color:#222;"><h1 style="font-size:1.4rem;">${message}</h1><p style="color:#666;">You won't receive further emails from us.</p></body></html>`,
    );
  }
}
