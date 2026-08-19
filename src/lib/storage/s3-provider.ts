import "server-only";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type { FileStorage, PutFileOptions } from "./types";

export interface S3ProviderConfig {
  bucket: string;
  region: string;
  endpoint?: string; // set for S3-compatible services (R2, MinIO, Backblaze, etc.)
  publicBaseUrl?: string; // CDN/public URL prefix, if the bucket is served through one
}

/**
 * S3-compatible storage for production. Works against AWS S3 or any
 * S3-compatible endpoint (R2, MinIO, Backblaze B2) by setting `endpoint`.
 * Enable with STORAGE_PROVIDER=s3 and the S3_* env vars (see .env.example).
 */
export class S3FileStorage implements FileStorage {
  readonly name = "s3";
  private client: S3Client;
  private config: S3ProviderConfig;

  constructor(config: S3ProviderConfig) {
    this.config = config;
    this.client = new S3Client({ region: config.region, endpoint: config.endpoint });
  }

  async put(key: string, data: Buffer | Uint8Array, options?: PutFileOptions) {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Body: data,
        ContentType: options?.contentType,
      })
    );
    return { url: this.urlFor(key) };
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      const res = await this.client.send(
        new GetObjectCommand({ Bucket: this.config.bucket, Key: key })
      );
      const bytes = await res.Body?.transformToByteArray();
      return bytes ? Buffer.from(bytes) : null;
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.config.bucket, Key: key }));
  }

  urlFor(key: string): string {
    if (this.config.publicBaseUrl) {
      return `${this.config.publicBaseUrl.replace(/\/+$/, "")}/${key}`;
    }
    return `https://${this.config.bucket}.s3.${this.config.region}.amazonaws.com/${key}`;
  }
}
