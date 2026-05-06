import {
  S3Client,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { Readable } from "node:stream";
import type { StorageProvider, GetObjectResult, HeadObjectResult } from "./types.js";
import { notFound, unprocessable } from "../../errors.js";

interface S3Config {
  bucket: string;
  region: string;
  endpoint?: string;
  prefix?: string;
  forcePathStyle?: boolean;
}

function cleanPrefix(raw: string | undefined): string {
  if (!raw) return "";
  return raw.trim().replace(/^\/+|\/+$/g, "");
}

function joinKey(prefix: string, key: string): string {
  return prefix ? `${prefix}/${key}` : key;
}

async function convertToStream(body: unknown): Promise<Readable> {
  if (!body) throw notFound("S3 object body is empty");
  if (body instanceof Readable) return body;

  const node = body as {
    transformToWebStream?: () => ReadableStream<Uint8Array>;
    arrayBuffer?: () => Promise<ArrayBuffer>;
  };

  if (typeof node.transformToWebStream === "function") {
    const webStream = node.transformToWebStream();
    const reader = webStream.getReader();
    return Readable.from((async function* () {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) yield value;
      }
    })());
  }

  if (typeof node.arrayBuffer === "function") {
    const buffer = Buffer.from(await node.arrayBuffer());
    return Readable.from(buffer);
  }

  throw unprocessable("S3 body type cannot be converted to readable stream");
}

function coerceDate(value: Date | undefined): Date | undefined {
  return value instanceof Date ? value : undefined;
}

export function createS3StorageProvider(config: S3Config): StorageProvider {
  const bucket = config.bucket.trim();
  const region = config.region.trim();
  if (!bucket) throw unprocessable("S3 bucket name is required");
  if (!region) throw unprocessable("S3 region is required");

  const prefix = cleanPrefix(config.prefix);
  const client = new S3Client({
    region,
    endpoint: config.endpoint,
    forcePathStyle: Boolean(config.forcePathStyle),
  });

  return {
    id: "s3",

    async putObject(input) {
      const key = joinKey(prefix, input.objectKey);
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: input.body,
          ContentType: input.contentType,
          ContentLength: input.contentLength,
        }),
      );
    },

    async getObject(input): Promise<GetObjectResult> {
      const key = joinKey(prefix, input.objectKey);
      try {
        const output = await client.send(
          new GetObjectCommand({
            Bucket: bucket,
            Key: key,
          }),
        );

        return {
          stream: await convertToStream(output.Body),
          contentType: output.ContentType,
          contentLength: output.ContentLength,
          etag: output.ETag,
          lastModified: coerceDate(output.LastModified),
        };
      } catch (err) {
        const code = (err as { name?: string }).name;
        if (code === "NoSuchKey" || code === "NotFound") throw notFound("S3 object not found");
        throw err;
      }
    },

    async headObject(input): Promise<HeadObjectResult> {
      const key = joinKey(prefix, input.objectKey);
      try {
        const output = await client.send(
          new HeadObjectCommand({
            Bucket: bucket,
            Key: key,
          }),
        );

        return {
          exists: true,
          contentType: output.ContentType,
          contentLength: output.ContentLength,
          etag: output.ETag,
          lastModified: coerceDate(output.LastModified),
        };
      } catch (err) {
        const code = (err as { name?: string }).name;
        if (code === "NoSuchKey" || code === "NotFound") return { exists: false };
        throw err;
      }
    },

    async deleteObject(input): Promise<void> {
      const key = joinKey(prefix, input.objectKey);
      await client.send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: key,
        }),
      );
    },
  };
}
