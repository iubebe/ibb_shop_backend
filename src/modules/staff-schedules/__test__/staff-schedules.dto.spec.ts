import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { CreateStaffScheduleDto } from '../dto/staff-schedules.dto.js';

/** Same options as main.ts. */
const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });

function validate(metatype: new () => object, value: unknown) {
  return pipe.transform(value, { type: 'body', metatype });
}

describe('CreateStaffScheduleDto validation (global pipe)', () => {
  it('accepts a week with shifts', async () => {
    const dto = await validate(CreateStaffScheduleDto, {
      weekStartDate: '2026-10-12',
      shifts: [{ dayOfWeek: 1, startTime: '08:00', endTime: '12:00', position: 'cashier' }],
    });
    expect(dto.shifts[0]).toMatchObject({ dayOfWeek: 1, startTime: '08:00', endTime: '12:00' });
  });

  it('rejects a shift with a bad time or day', async () => {
    await expect(
      validate(CreateStaffScheduleDto, {
        weekStartDate: '2026-10-12',
        shifts: [{ dayOfWeek: 9, startTime: '8am', endTime: '12:00' }],
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
