import { Controller, Get } from '@nestjs/common';
import { NoThrottle } from '../throttle/decorators.js';
import { Public } from '../auth/decorators/public.decorator.js';

@NoThrottle()
@Public()
@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { status: 'ok' };
  }
}
