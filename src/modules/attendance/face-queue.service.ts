import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { REDIS_KEY } from '../../constants/redis-key.constants.js';
import { RedisService } from '../../redis/redis.service.js';
import type { FaceCheckJob } from './attendance.types.js';

/**
 * Hands attendance photos to a (not yet built) face-detection worker through
 * a Redis list: producers LPUSH, the worker will BRPOP. The database row
 * (`*FaceStatus = pending`) is the source of truth, so a lost push can be
 * re-queued by sweeping pending rows.
 */
@Injectable()
export class FaceQueueService {
  constructor(
    private readonly redis: RedisService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(FaceQueueService.name);
  }

  /** Never throws: a queue outage must not block a check-in. */
  async enqueue(job: Omit<FaceCheckJob, 'enqueuedAt'>): Promise<void> {
    const payload: FaceCheckJob = {
      ...job,
      enqueuedAt: new Date().toISOString(),
    };
    try {
      await this.redis.client.lpush(
        REDIS_KEY.ATTENDANCE_FACE_QUEUE,
        JSON.stringify(payload),
      );
    } catch (err) {
      this.logger.warn(
        { err, recordId: job.recordId, kind: job.kind },
        'Could not queue face check; the photo stays pending',
      );
    }
  }
}
