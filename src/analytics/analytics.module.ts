import { Module } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { TrackingPixelController } from './tracking-pixel.controller';
import { AnalyticsController } from './analytics.controller';

@Module({
  controllers: [TrackingPixelController, AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
