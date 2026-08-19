import "server-only";
import { LocalFileStorage } from "./local-provider";
import { S3FileStorage } from "./s3-provider";
import type { FileStorage } from "./types";

export * from "./types";
export { LocalFileStorage } from "./local-provider";
export { S3FileStorage } from "./s3-provider";

let cached: FileStorage | null = null;

export function getFileStorage(): FileStorage {
  if (cached) return cached;

  if (process.env.STORAGE_PROVIDER === "s3") {
    const bucket = process.env.S3_BUCKET;
    const region = process.env.S3_REGION;
    if (!bucket || !region) {
      throw new Error("STORAGE_PROVIDER=s3 requires S3_BUCKET and S3_REGION to be set.");
    }
    cached = new S3FileStorage({
      bucket,
      region,
      endpoint: process.env.S3_ENDPOINT,
      publicBaseUrl: process.env.S3_PUBLIC_BASE_URL,
    });
  } else {
    cached = new LocalFileStorage();
  }
  return cached;
}
