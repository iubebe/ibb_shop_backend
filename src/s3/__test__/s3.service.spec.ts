import { Test } from '@nestjs/testing';
import { PinoLogger } from 'nestjs-pino';
import { S3_CLIENT, S3_OPTIONS } from '../s3.constants.js';
import { S3Service } from '../s3.service.js';
import type { S3Options } from '../s3.types.js';

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn().mockResolvedValue('https://signed'),
}));

const options: S3Options = {
  endpoint: 'http://rustfs:9000',
  region: 'us-east-1',
  accessKey: 'k',
  secretKey: 's',
  bucket: 'ibb-media',
  publicUrl: 'http://localhost:9000/ibb-media',
};

const notFound = () =>
  Object.assign(new Error('nf'), {
    name: 'NotFound',
    $metadata: { httpStatusCode: 404 },
  });

describe('S3Service', () => {
  let service: S3Service;
  let send: ReturnType<typeof vi.fn>;
  const input = (n = 0) => send.mock.calls[n][0].input;

  beforeEach(async () => {
    send = vi.fn().mockResolvedValue({});
    const moduleRef = await Test.createTestingModule({
      providers: [
        S3Service,
        { provide: S3_CLIENT, useValue: { send } },
        { provide: S3_OPTIONS, useValue: options },
        {
          provide: PinoLogger,
          useValue: { setContext: vi.fn(), info: vi.fn(), error: vi.fn() },
        },
      ],
    }).compile();
    service = moduleRef.get(S3Service);
  });

  it('uploads to the default bucket and returns the public url', async () => {
    send.mockResolvedValue({ ETag: '"e"' });
    const res = await service.upload('products/a b.png', Buffer.from('x'), {
      contentType: 'image/png',
    });
    expect(input()).toMatchObject({
      Bucket: 'ibb-media',
      Key: 'products/a b.png',
      ContentType: 'image/png',
    });
    expect(res).toEqual({
      bucket: 'ibb-media',
      key: 'products/a b.png',
      etag: '"e"',
      url: 'http://localhost:9000/ibb-media/products/a%20b.png',
    });
  });

  it('uses the endpoint for urls of non-default buckets', () => {
    expect(service.getPublicUrl('a.png', 'other')).toBe(
      'http://rustfs:9000/other/a.png',
    );
  });

  it('exists is false on 404 and rethrows other errors', async () => {
    send.mockRejectedValueOnce(notFound());
    await expect(service.exists('x')).resolves.toBe(false);
    send.mockRejectedValueOnce(new Error('boom'));
    await expect(service.exists('x')).rejects.toThrow('boom');
    send.mockResolvedValueOnce({});
    await expect(service.exists('x')).resolves.toBe(true);
  });

  it('ensureBucket creates only when missing', async () => {
    await expect(service.ensureBucket()).resolves.toBe(false);
    expect(send).toHaveBeenCalledTimes(1);
    send.mockReset();
    send.mockRejectedValueOnce(notFound()).mockResolvedValueOnce({});
    await expect(service.ensureBucket()).resolves.toBe(true);
    expect(input(1)).toEqual({ Bucket: 'ibb-media' });
  });

  it('deleteMany chunks by 1000 and throws on partial errors', async () => {
    const keys = Array.from({ length: 1001 }, (_, i) => `k${i}`);
    await service.deleteMany(keys);
    expect(send).toHaveBeenCalledTimes(2);
    expect(input(0).Delete.Objects).toHaveLength(1000);

    send.mockResolvedValueOnce({ Errors: [{ Key: 'k', Message: 'denied' }] });
    await expect(service.deleteMany(['k'])).rejects.toThrow('denied');
  });

  it('list follows pagination', async () => {
    send
      .mockResolvedValueOnce({
        Contents: [{ Key: 'a', Size: 1 }],
        IsTruncated: true,
        NextContinuationToken: 't',
      })
      .mockResolvedValueOnce({ Contents: [{ Key: 'b', Size: 2 }] });
    const out = await service.list('p/');
    expect(out.map((o) => o.key)).toEqual(['a', 'b']);
    expect(input(1).ContinuationToken).toBe('t');
  });

  it('returns presigned urls', async () => {
    await expect(service.getPresignedGetUrl('a')).resolves.toBe(
      'https://signed',
    );
    await expect(service.getPresignedPutUrl('a')).resolves.toBe(
      'https://signed',
    );
  });
});
