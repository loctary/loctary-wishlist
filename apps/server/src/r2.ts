import { AwsClient } from "aws4fetch";
import { env } from "./env.js";

/**
 * Cloudflare R2 via its S3-compatible API, signed with aws4fetch. aws4fetch is a
 * tiny SigV4 signer built on `fetch`, so the exact same code works in the Node
 * dev server and in the Cloudflare Worker (no R2 binding, no SDK split).
 *
 * Wishlist item images are written to `wishlist/<itemId>/<uuid>.webp` and served
 * publicly from `R2_PUBLIC_BASE_URL` (the bucket's r2.dev URL or a custom domain).
 * The bucket is shared with loctary-auth (avatars are under `avatars/`), so this
 * file mirrors auth's r2.ts; only the listing helper is added here for the cron.
 */

let client: AwsClient | null = null;

function aws(): AwsClient {
  client ??= new AwsClient({
    accessKeyId: env.r2AccessKeyId,
    secretAccessKey: env.r2SecretAccessKey,
    service: "s3",
    region: "auto",
  });
  return client;
}

/** True only when R2 is fully configured. */
export function r2Configured(): boolean {
  return Boolean(
    env.r2AccountId &&
      env.r2AccessKeyId &&
      env.r2SecretAccessKey &&
      env.r2Bucket &&
      env.r2PublicBaseUrl,
  );
}

function objectUrl(key: string): string {
  return `https://${env.r2AccountId}.r2.cloudflarestorage.com/${env.r2Bucket}/${key}`;
}

function bucketUrl(): string {
  return `https://${env.r2AccountId}.r2.cloudflarestorage.com/${env.r2Bucket}`;
}

/** Public URL an object is reachable at. */
export function publicUrl(key: string): string {
  return `${env.r2PublicBaseUrl}/${key}`;
}

/**
 * If `url` points at an object in our bucket, return its key — else null. Used
 * to detect whether an externally-supplied URL is one of ours.
 */
export function keyFromPublicUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const prefix = `${env.r2PublicBaseUrl}/`;
  return url.startsWith(prefix) ? url.slice(prefix.length) : null;
}

export async function putObject(key: string, body: ArrayBuffer, contentType: string): Promise<void> {
  const res = await aws().fetch(objectUrl(key), {
    method: "PUT",
    body,
    headers: { "Content-Type": contentType },
  });
  if (!res.ok) {
    throw new Error(`R2 put failed: ${res.status} ${await res.text().catch(() => "")}`);
  }
}

export async function deleteObject(key: string): Promise<void> {
  const res = await aws().fetch(objectUrl(key), { method: "DELETE" });
  // 404 is fine — the object is already gone.
  if (!res.ok && res.status !== 404) {
    throw new Error(`R2 delete failed: ${res.status}`);
  }
}

export interface R2Object {
  key: string;
  /** ISO timestamp of object creation in R2. */
  lastModified: string;
}

/**
 * List every object under `prefix` (paginated via ListObjectsV2). Used by the
 * nightly cron to enumerate `wishlist/` and diff against referenced keys.
 */
export async function listObjects(prefix: string): Promise<R2Object[]> {
  const out: R2Object[] = [];
  let continuationToken: string | undefined;
  do {
    const u = new URL(bucketUrl());
    u.searchParams.set("list-type", "2");
    u.searchParams.set("prefix", prefix);
    u.searchParams.set("max-keys", "1000");
    if (continuationToken) u.searchParams.set("continuation-token", continuationToken);

    const res = await aws().fetch(u.toString(), { method: "GET" });
    if (!res.ok) throw new Error(`R2 list failed: ${res.status}`);
    const xml = await res.text();

    // Tiny XML scrape — ListObjectsV2 response is flat <Contents><Key>…</Key><LastModified>…</LastModified></Contents>.
    const contents = xml.match(/<Contents>[\s\S]*?<\/Contents>/g) ?? [];
    for (const block of contents) {
      const key = block.match(/<Key>([^<]+)<\/Key>/)?.[1];
      const lastModified = block.match(/<LastModified>([^<]+)<\/LastModified>/)?.[1];
      if (key && lastModified) out.push({ key, lastModified });
    }

    const truncated = /<IsTruncated>true<\/IsTruncated>/.test(xml);
    continuationToken = truncated ? xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/)?.[1] : undefined;
  } while (continuationToken);

  return out;
}
