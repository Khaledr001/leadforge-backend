import { Module } from '@nestjs/common';
import { AiCopyModule } from '../ai-copy/ai-copy.module';
import { SitesController } from './sites.controller';
import { SitesService } from './sites.service';
import { GeneratorService } from './generator.service';
import { DeployerService } from './deployer.service';

@Module({
  imports: [AiCopyModule],
  controllers: [SitesController],
  providers: [SitesService, GeneratorService, DeployerService],
  exports: [SitesService],
})
export class SitesModule {}
