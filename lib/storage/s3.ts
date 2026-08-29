import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectVersionsCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const bucket = process.env.S3_BUCKET;
const region = process.env.AWS_REGION;
const endpoint = process.env.S3_ENDPOINT;

if (!bucket) {
  throw new Error("S3_BUCKET is not configured");
}

if (!region) {
  throw new Error("AWS_REGION is not configured");
}

if (!endpoint) {
  throw new Error("S3_ENDPOINT is not configured");
}

if (!process.env.AWS_ACCESS_KEY_ID) {
  throw new Error("AWS_ACCESS_KEY_ID is not configured");
}

if (!process.env.AWS_SECRET_ACCESS_KEY) {
  throw new Error("AWS_SECRET_ACCESS_KEY is not configured");
}

export const s3 = new S3Client({
  region,
  endpoint,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

export async function createUploadUrl(
  key: string,
  contentType: string
) {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });

  return getSignedUrl(s3, command, {
    expiresIn: 60 * 10,
  });
}

export async function createDownloadUrl(key: string) {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  return getSignedUrl(s3, command, {
    expiresIn: 60 * 10,
  });
}

export async function getObjectSize(key: string) {
  const result = await s3.send(
    new HeadObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );

  if (typeof result.ContentLength !== "number") {
    throw new Error("B2 object has no Content-Length");
  }

  return result.ContentLength;
}

/**
 * Permanently removes ALL B2 versions of a storage key.
 *
 * This is important because the B2 bucket is configured to
 * "Keep all versions". A normal DeleteObject call may only
 * create a delete marker while older versions continue
 * consuming storage.
 */
export async function deleteObject(key: string) {
  let keyMarker: string | undefined;
  let versionIdMarker: string | undefined;

  do {
    const result = await s3.send(
      new ListObjectVersionsCommand({
        Bucket: bucket,
        Prefix: key,
        KeyMarker: keyMarker,
        VersionIdMarker: versionIdMarker,
      })
    );

    const versions = [
      ...(result.Versions ?? []),
      ...(result.DeleteMarkers ?? []),
    ].filter(
      (item) =>
        item.Key === key &&
        typeof item.VersionId === "string"
    );

    for (const version of versions) {
      await s3.send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: key,
          VersionId: version.VersionId,
        })
      );
    }

    if (!result.IsTruncated) {
      break;
    }

    keyMarker = result.NextKeyMarker;
    versionIdMarker = result.NextVersionIdMarker;
  } while (keyMarker || versionIdMarker);
}