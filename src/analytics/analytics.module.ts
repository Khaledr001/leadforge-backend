import { Module } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { TrackingPixelController } from './tracking-pixel.controller';

@Module({
  controllers: [TrackingPixelController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
