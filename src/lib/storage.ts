import fs from "fs/promises";
import path from "path";

import { PutObjectCommand, DeleteObjectsCommand, S3Client } from "@aws-sdk/client-s3";

import { getConfiguredSiteUrl } from "@/lib/site-url";

export type StorageBackend = "r2" | "local";

export interface StoredObject {
  path: string;
  publicUrl: string;
  backend: StorageBackend;
}

function getR2Endpoint(): string {
  const raw = (process.env.CLOUDFLARE_R2_ENDPOINT || "").trim().replace(/\/+$/, "");
  if (!raw) return "";

  const bucket = (process.env.CLOUDFLARE_R2_BUCKET_NAME || "").trim();
  if (bucket && raw.endsWith(`/${bucket}`)) {
    return raw.slice(0, -(bucket.length + 1));
  }

  return raw;
}

export function buildObjectKey(logicalBucket: string, objectPath: string): string {
  return `${logicalBucket}/${objectPath.replace(/^\/+/, "")}`;
}

function getLocalUploadRoot(): string {
  return path.join(process.cwd(), "public", "uploads");
}

function getLocalPublicBaseUrl(): string {
  const configured = getConfiguredSiteUrl();
  if (configured) return `${configured}/uploads`;
  return "/uploads";
}

function getR2PublicBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_CLOUDFLARE_R2_PUBLIC_URL || "").replace(/\/+$/, "");
}

export function createR2Client(): S3Client | null {
  const endpoint = getR2Endpoint();
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || "";
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || "";

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    return null;
  }

  return new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });
}

function isAccessDeniedError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { name?: string; Code?: string; message?: string };
  return (
    e.name === "AccessDenied" ||
    e.Code === "AccessDenied" ||
    (typeof e.message === "string" && e.message.includes("Access Denied"))
  );
}

async function uploadToLocal(
  key: string,
  body: Buffer,
): Promise<StoredObject> {
  const filePath = path.join(getLocalUploadRoot(), key);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, body);

  const objectPath = key.includes("/") ? key.slice(key.indexOf("/") + 1) : key;

  return {
    path: objectPath,
    publicUrl: `${getLocalPublicBaseUrl()}/${key}`,
    backend: "local",
  };
}

async function uploadToR2(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<StoredObject> {
  const client = createR2Client();
  const bucket = (process.env.CLOUDFLARE_R2_BUCKET_NAME || "").trim();
  const publicBase = getR2PublicBaseUrl();

  if (!client || !bucket || !publicBase) {
    throw new Error("Cloudflare R2 is not fully configured.");
  }

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );

  const objectPath = key.includes("/") ? key.slice(key.indexOf("/") + 1) : key;

  return {
    path: objectPath,
    publicUrl: `${publicBase}/${key}`,
    backend: "r2",
  };
}

export async function uploadObject(
  logicalBucket: string,
  objectPath: string,
  body: Buffer,
  contentType: string,
): Promise<StoredObject> {
  const key = buildObjectKey(logicalBucket, objectPath);
  const client = createR2Client();
  const bucket = (process.env.CLOUDFLARE_R2_BUCKET_NAME || "").trim();
  const publicBase = getR2PublicBaseUrl();

  if (!client || !bucket || !publicBase) {
    return uploadToLocal(key, body);
  }

  try {
    return await uploadToR2(key, body, contentType);
  } catch (err) {
    if (isAccessDeniedError(err)) {
      console.warn(
        "[storage] R2 write denied — falling back to local uploads. Update the R2 API token to allow Object Write.",
      );
      return uploadToLocal(key, body);
    }
    throw err;
  }
}

export async function deleteObjects(
  logicalBucket: string,
  paths: string[],
): Promise<void> {
  const keys = paths.map((p) => buildObjectKey(logicalBucket, p));

  for (const key of keys) {
    const localPath = path.join(getLocalUploadRoot(), key);
    try {
      await fs.unlink(localPath);
    } catch (err: any) {
      if (err?.code !== "ENOENT") {
        console.warn(`[storage] local delete failed for ${key}:`, err.message);
      }
    }
  }

  const client = createR2Client();
  const bucket = (process.env.CLOUDFLARE_R2_BUCKET_NAME || "").trim();
  if (!client || !bucket || keys.length === 0) return;

  try {
    await client.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: keys.map((Key) => ({ Key })) },
      }),
    );
  } catch (err) {
    if (!isAccessDeniedError(err)) {
      throw err;
    }
    console.warn("[storage] R2 delete denied — removed local copies only.");
  }
}

export function buildPublicUrl(logicalBucket: string, objectPath: string): string {
  const key = buildObjectKey(logicalBucket, objectPath);
  const publicBase = getR2PublicBaseUrl();
  if (publicBase) return `${publicBase}/${key}`;
  return `${getLocalPublicBaseUrl()}/${key}`;
}
