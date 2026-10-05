import { BadRequestException } from '@nestjs/common';
import { assertJpeg } from '../photo.js';

describe('assertJpeg', () => {
  it('accepts JPEG magic bytes', () => {
    expect(() => assertJpeg(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0]))).not.toThrow();
  });

  it('rejects a missing, empty or non-JPEG body', () => {
    expect(() => assertJpeg(undefined)).toThrow(BadRequestException);
    expect(() => assertJpeg(Buffer.alloc(0))).toThrow(BadRequestException);
    expect(() => assertJpeg(Buffer.from('<?php'))).toThrow(BadRequestException);
    expect(() => assertJpeg(Buffer.from([0x89, 0x50, 0x4e, 0x47]))).toThrow(BadRequestException);
  });
});
