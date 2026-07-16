import { Body, Controller, Post } from '@nestjs/common';
import { ReceptionistService } from './receptionist.service';
import { Public } from '../common/decorators/public.decorator';
import { SkipTransform } from '../common/decorators/skip-transform.decorator';

@Controller('webhooks')
export class VapiWebhookController {
  constructor(private readonly receptionist: ReceptionistService) {}

  @Public()
  @SkipTransform()
  @Post('vapi')
  async handle(@Body() payload: Record<string, unknown>): Promise<{ received: true }> {
    await this.receptionist.handleWebhook(payload ?? {});
    return { received: true };
  }
}
