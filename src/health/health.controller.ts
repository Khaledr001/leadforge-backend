import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { SkipTransform } from '../common/decorators/skip-transform.decorator';

@Controller('health')
export class HealthController {
  @Public()
  @SkipTransform()
  @Get()
  check(): { status: string } {
    return { status: 'ok' };
  }
}
