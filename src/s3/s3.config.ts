import type { ConfigService } from '@nestjs/config';
import type { S3Options } from './s3.types.js';

/**
 * Env: S3_ENDPOINT (http://localhost:9000), S3_REGION (us-east-1),
 * S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET (ibb-media), S3_PUBLIC_URL
 */
export function loadS3Options(config: ConfigService): S3Options {
  const endpoint = config
    .get<string>('S3_ENDPOINT', 'http://localhost:9000')
    .replace(/\/+$/, '');
  const bucket = config.get<string>('S3_BUCKET', 'ibb-media');
  const publicUrl = (
    config.get<string>('S3_PUBLIC_URL') || `${endpoint}/${bucket}`
  ).replace(/\/+$/, '');

  return {
    endpoint,
    region: config.get<string>('S3_REGION', 'us-east-1'),
    accessKey: config.get<string>('S3_ACCESS_KEY', 'ibb_rustfs'),
    secretKey: config.get<string>('S3_SECRET_KEY', 'ibb_rustfs_secret'),
    bucket,
    publicUrl,
  };
}
