import { Controller, Get, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { PrismaService } from '../database/prisma.service';

class RecentEventsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly prisma: PrismaService) {}

  /** Recent activity feed for the dashboard home. */
  @Get('events')
  events(@Query() query: RecentEventsDto) {
    return this.prisma.analyticsEvent.findMany({
      take: query.limit,
      orderBy: { createdAt: 'desc' },
      include: { lead: { select: { id: true, businessName: true } } },
    });
  }
}
