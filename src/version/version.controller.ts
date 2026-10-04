import { Controller, Get } from '@nestjs/common';
import { VersionService } from './version.service.js';
import { Public } from '../auth/decorators/public.decorator.js';

@Public()
@Controller('version')
export class VersionController {
  constructor(private readonly versionService: VersionService) {}

  @Get()
  get() {
    return this.versionService.get();
  }
}
