export interface PutFileOptions {
  contentType?: string;
}

/**
 * Storage abstraction so the app never talks to the filesystem or S3
 * directly. `LocalFileStorage` is used automatically in development;
 * swap in an S3-compatible implementation (see `s3-provider.ts`) by setting
 * STORAGE_PROVIDER=s3 and the bucket/credentials env vars in production.
 */
export interface FileStorage {
  readonly name: string;
  put(key: string, data: Buffer | Uint8Array, options?: PutFileOptions): Promise<{ url: string }>;
  get(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<void>;
  /** Publicly resolvable URL for a stored key (may be relative for local dev). */
  urlFor(key: string): string;
}
