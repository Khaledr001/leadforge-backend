import { Module } from '@nestjs/common';
import { EnricherController } from './enricher.controller';
import { EnricherService } from './enricher.service';
import { FacebookProvider } from './providers/facebook.provider';
import { EmailFinderProvider } from './providers/email-finder.provider';
import { MxCheckerProvider } from './providers/mx-checker.provider';

@Module({
  controllers: [EnricherController],
  providers: [
    EnricherService,
    FacebookProvider,
    EmailFinderProvider,
    MxCheckerProvider,
  ],
  exports: [EnricherService],
})
export class EnricherModule {}
