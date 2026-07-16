import { Module } from '@nestjs/common';
import { AiCopyService } from './ai-copy.service';
import { anthropicClientProvider } from './anthropic.provider';

/**
 * AI copy generation module. Has no controller — AiCopyService is consumed by
 * the sites (Phase 7) and ai-services (Phase 10) modules.
 */
@Module({
  providers: [AiCopyService, anthropicClientProvider],
  exports: [AiCopyService],
})
export class AiCopyModule {}
