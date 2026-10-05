import type { Readable } from 'node:stream';

export interface S3Options {
  endpoint: string;
  region: string;
  accessKey: string;
  secretKey: string;
  /** Default bucket used when a method is not given one. */
  bucket: string;
  /**
   * Base URL browsers use to read objects (e.g. `http://localhost:9000/ibb-media`
   * or a CDN / reverse-proxy path). Defaults to `<endpoint>/<bucket>`.
   */
  publicUrl: string;
}

export type S3Body = Buffer | Uint8Array | string | Readable;

export interface UploadOptions {
  contentType?: string;
  cacheControl?: string;
  metadata?: Record<string, string>;
  /** Override the default bucket. */
  bucket?: string;
}

export interface UploadResult {
  bucket: string;
  key: string;
  etag?: string;
  /** Public URL of the object (see `S3Options.publicUrl`). */
  url: string;
}

export interface DownloadResult {
  body: Readable;
  contentType?: string;
  contentLength?: number;
  etag?: string;
}

export interface ObjectSummary {
  key: string;
  size: number;
  lastModified?: Date;
}
