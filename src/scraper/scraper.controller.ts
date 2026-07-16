import { Body, Controller, Post } from '@nestjs/common';
import { ScraperService } from './scraper.service';
import { ScrapeRequestDto } from './dto/scrape-request.dto';
import { Public } from '../common/decorators/public.decorator';

@Controller('scraper')
export class ScraperController {
  constructor(private readonly scraperService: ScraperService) {}

  @Public()
  @Post('run')
  run(@Body() dto: ScrapeRequestDto) {
    return this.scraperService.scrape(dto.query, dto.maxResults, dto.mode);
  }
}
