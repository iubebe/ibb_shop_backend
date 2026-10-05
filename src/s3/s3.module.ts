import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client } from '@aws-sdk/client-s3';
import { loadS3Options } from './s3.config.js';
import { S3_CLIENT, S3_OPTIONS } from './s3.constants.js';
import { S3Service } from './s3.service.js';
import type { S3Options } from './s3.types.js';

/**
 * Global S3 module backed by RustFS (any S3-compatible store). Import once in
 * AppModule, then inject `S3Service` anywhere.
 *
 * Env: S3_ENDPOINT, S3_REGION, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET, S3_PUBLIC_URL
 */
@Global()
@Module({
  providers: [
    {
      provide: S3_OPTIONS,
      inject: [ConfigService],
      useFactory: loadS3Options,
    },
    {
      provide: S3_CLIENT,
      inject: [S3_OPTIONS],
      useFactory: (o: S3Options) =>
        new S3Client({
          endpoint: o.endpoint,
          region: o.region,
          credentials: {
            accessKeyId: o.accessKey,
            secretAccessKey: o.secretKey,
          },
          forcePathStyle: true, // RustFS/MinIO use path-style, not bucket.host
        }),
    },
    S3Service,
  ],
  exports: [S3_CLIENT, S3_OPTIONS, S3Service],
})
export class S3Module {}
