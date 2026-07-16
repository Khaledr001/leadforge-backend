import { Body, Controller, Get, Post } from '@nestjs/common';
import { EnricherService } from './enricher.service';
import { EnrichLeadDto } from './dto/enrich-lead.dto';
import { EnrichBatchDto } from './dto/enrich-batch.dto';

@Controller('enricher')
export class EnricherController {
  constructor(private readonly enricherService: EnricherService) {}

  @Post('run')
  run(@Body() dto: EnrichLeadDto) {
    return this.enricherService.enrichLead(dto.leadId);
  }

  @Post('batch')
  batch(@Body() dto: EnrichBatchDto) {
    return this.enricherService.enrichBatch(dto);
  }

  @Get('stats')
  stats() {
    return this.enricherService.getStats();
  }
}
