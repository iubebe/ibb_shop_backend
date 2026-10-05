import { BadRequestException } from '@nestjs/common';

/** The client always sends a canvas JPEG; check the bytes, not the header. */
export function assertJpeg(buffer: Buffer | undefined): asserts buffer is Buffer {
  if (!buffer?.length) throw new BadRequestException('Photo is required');
  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (!isJpeg) throw new BadRequestException('Photo must be a JPEG image');
}
