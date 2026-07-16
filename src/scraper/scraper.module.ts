import { Module } from '@nestjs/common';
import { ScraperController } from './scraper.controller';
import { ScraperService } from './scraper.service';
import { GooglePlacesProvider } from './providers/google-places.provider';
import { OutscraperProvider } from './providers/outscraper.provider';
import {
  IScraperProvider,
  SCRAPER_PROVIDERS,
  ScraperMode,
} from './interfaces/scraper-provider.interface';

@Module({
  controllers: [ScraperController],
  providers: [
    ScraperService,
    GooglePlacesProvider,
    OutscraperProvider,
    {
      provide: SCRAPER_PROVIDERS,
      useFactory: (
        google: GooglePlacesProvider,
        outscraper: OutscraperProvider,
      ): Record<ScraperMode, IScraperProvider> => ({
        api: google,
        outscraper,
      }),
      inject: [GooglePlacesProvider, OutscraperProvider],
    },
  ],
  exports: [ScraperService],
})
export class ScraperModule {}
