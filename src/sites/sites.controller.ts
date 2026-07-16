import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { SitesService } from './sites.service';
import { GenerateSiteDto } from './dto/generate-site.dto';
import { BatchGenerateDto } from './dto/batch-generate.dto';
import { ListSitesDto } from './dto/list-sites.dto';
import { SkipTransform } from '../common/decorators/skip-transform.decorator';

@Controller('sites')
export class SitesController {
  constructor(private readonly sitesService: SitesService) {}

  @Post('generate')
  generate(@Body() dto: GenerateSiteDto) {
    return this.sitesService.createAndDeploy(dto.leadId);
  }

  @Post('generate-batch')
  generateBatch(@Body() dto: BatchGenerateDto) {
    return this.sitesService.batchGenerate(dto);
  }

  @Get()
  findAll(@Query() query: ListSitesDto) {
    return this.sitesService.findAll(query.page, query.limit);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.sitesService.findOne(id);
  }

  @Get(':id/analytics')
  analytics(@Param('id', ParseUUIDPipe) id: string) {
    return this.sitesService.getAnalytics(id);
  }

  @Delete(':id')
  @SkipTransform()
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.sitesService.remove(id);
  }
}
