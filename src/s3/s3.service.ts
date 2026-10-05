import { Inject, Injectable } from '@nestjs/common';
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Readable } from 'node:stream';
import { PinoLogger } from 'nestjs-pino';
import { S3_CLIENT, S3_OPTIONS } from './s3.constants.js';
import type {
  DownloadResult,
  ObjectSummary,
  S3Body,
  S3Options,
  UploadOptions,
  UploadResult,
} from './s3.types.js';

@Injectable()
export class S3Service {
  constructor(
    @Inject(S3_CLIENT) readonly client: S3Client,
    @Inject(S3_OPTIONS) readonly options: S3Options,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(S3Service.name);
  }

  get defaultBucket(): string {
    return this.options.bucket;
  }

  /** Create the bucket if it does not exist yet. Returns true when created. */
  async ensureBucket(bucket = this.options.bucket): Promise<boolean> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: bucket }));
      return false;
    } catch (err) {
      if (!isNotFound(err)) throw err;
    }
    await this.client.send(new CreateBucketCommand({ Bucket: bucket }));
    this.logger.info({ bucket }, 'S3 bucket created');
    return true;
  }

  async upload(
    key: string,
    body: S3Body,
    opts: UploadOptions = {},
  ): Promise<UploadResult> {
    const bucket = opts.bucket ?? this.options.bucket;
    const res = await this.client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: opts.contentType,
        CacheControl: opts.cacheControl,
        Metadata: opts.metadata,
      }),
    );
    return { bucket, key, etag: res.ETag, url: this.getPublicUrl(key, bucket) };
  }

  /** Streams the object. Throws if it does not exist (check with `exists`). */
  async download(key: string, bucket?: string): Promise<DownloadResult> {
    const res = await this.client.send(
      new GetObjectCommand({ Bucket: bucket ?? this.options.bucket, Key: key }),
    );
    return {
      body: res.Body as Readable,
      contentType: res.ContentType,
      contentLength: res.ContentLength,
      etag: res.ETag,
    };
  }

  async exists(key: string, bucket?: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: bucket ?? this.options.bucket,
          Key: key,
        }),
      );
      return true;
    } catch (err) {
      if (isNotFound(err)) return false;
      throw err;
    }
  }

  /** Deleting a missing key is not an error (S3 semantics). */
  async delete(key: string, bucket?: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: bucket ?? this.options.bucket,
        Key: key,
      }),
    );
  }

  /** Deletes up to 1000 keys per request; larger inputs are chunked. */
  async deleteMany(keys: string[], bucket?: string): Promise<void> {
    for (let i = 0; i < keys.length; i += 1000) {
      const res = await this.client.send(
        new DeleteObjectsCommand({
          Bucket: bucket ?? this.options.bucket,
          Delete: {
            Objects: keys.slice(i, i + 1000).map((Key) => ({ Key })),
            Quiet: true,
          },
        }),
      );
      if (res.Errors?.length) {
        throw new Error(
          `Failed to delete ${res.Errors.length} S3 object(s): ${res.Errors[0].Key}: ${res.Errors[0].Message}`,
        );
      }
    }
  }

  /** Lists every object under `prefix` (follows pagination). */
  async list(prefix = '', bucket?: string): Promise<ObjectSummary[]> {
    const out: ObjectSummary[] = [];
    let token: string | undefined;
    do {
      const res = await this.client.send(
        new ListObjectsV2Command({
          Bucket: bucket ?? this.options.bucket,
          Prefix: prefix,
          ContinuationToken: token,
        }),
      );
      for (const o of res.Contents ?? []) {
        out.push({
          key: o.Key!,
          size: o.Size ?? 0,
          lastModified: o.LastModified,
        });
      }
      token = res.IsTruncated ? res.NextContinuationToken : undefined;
    } while (token);
    return out;
  }

  /** Public (unsigned) URL; only readable if the bucket/path allows anonymous reads. */
  getPublicUrl(key: string, bucket?: string): string {
    const encoded = key.split('/').map(encodeURIComponent).join('/');
    const base =
      bucket && bucket !== this.options.bucket
        ? `${this.options.endpoint}/${bucket}`
        : this.options.publicUrl;
    return `${base}/${encoded}`;
  }

  /** Time-limited read URL for private objects. */
  async getPresignedGetUrl(
    key: string,
    expiresInSeconds = 3600,
    bucket?: string,
  ): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: bucket ?? this.options.bucket, Key: key }),
      { expiresIn: expiresInSeconds },
    );
  }

  /** Time-limited URL a client can PUT a file to directly. */
  async getPresignedPutUrl(
    key: string,
    opts: {
      contentType?: string;
      expiresInSeconds?: number;
      bucket?: string;
    } = {},
  ): Promise<string> {
    return getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: opts.bucket ?? this.options.bucket,
        Key: key,
        ContentType: opts.contentType,
      }),
      { expiresIn: opts.expiresInSeconds ?? 900 },
    );
  }
}

function isNotFound(err: unknown): boolean {
  const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
  return (
    e?.$metadata?.httpStatusCode === 404 ||
    e?.name === 'NotFound' ||
    e?.name === 'NoSuchKey' ||
    e?.name === 'NoSuchBucket'
  );
}
