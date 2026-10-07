import { BadRequestException } from '@nestjs/common';

export const IMAGE_FIELD = 'image';
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;

export interface ImageType {
  ext: string;
  contentType: string;
}

/** Sniff the bytes, not the client-sent header or file name. */
export function detectImage(buffer: Buffer | undefined): ImageType {
  if (!buffer?.length) throw new BadRequestException('Image is required');
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { ext: 'jpg', contentType: 'image/jpeg' };
  }
  if (buffer.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) {
    return { ext: 'png', contentType: 'image/png' };
  }
  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { ext: 'webp', contentType: 'image/webp' };
  }
  throw new BadRequestException('Image must be JPEG, PNG or WebP');
}
