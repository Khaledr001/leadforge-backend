import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ReceptionistService } from './receptionist.service';
import { SocialAgentService } from './social-agent.service';
import { GbpService } from './gbp.service';
import { SetupReceptionistDto } from './dto/setup-receptionist.dto';
import { GenerateSocialDto } from './dto/generate-social.dto';
import { SchedulePostDto } from './dto/schedule-post.dto';
import { GbpReportDto } from './dto/gbp-report.dto';

@Controller('ai-services')
export class AiServicesController {
  constructor(
    private readonly receptionist: ReceptionistService,
    private readonly socialAgent: SocialAgentService,
    private readonly gbp: GbpService,
  ) {}

  @Post('receptionist/setup')
  setupReceptionist(@Body() dto: SetupReceptionistDto) {
    return this.receptionist.setupAssistant(dto.clientId);
  }

  @Get('receptionist/:id/calls')
  calls(@Param('id', ParseUUIDPipe) id: string) {
    return this.receptionist.getCallLogs(id);
  }

  @Post('social/generate')
  generateSocial(@Body() dto: GenerateSocialDto) {
    return this.socialAgent.generateBatch(dto.clientId, dto.count, dto.platform);
  }

  @Post('social/schedule')
  schedulePost(@Body() dto: SchedulePostDto) {
    return this.socialAgent.schedulePost(dto.postId, new Date(dto.scheduledFor));
  }

  @Get('social/:clientId/calendar')
  calendar(@Param('clientId', ParseUUIDPipe) clientId: string) {
    return this.socialAgent.getCalendar(clientId);
  }

  @Post('gbp/report')
  gbpReport(@Body() dto: GbpReportDto) {
    return this.gbp.generateReport(dto.clientId);
  }
}
