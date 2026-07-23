import { createHash } from "node:crypto";
import sharp, { type Metadata } from "sharp";

export const CONCIERGE_IMAGE_LIMITS = Object.freeze({
  maxInputBytes: 5 * 1024 * 1024,
  minWidth: 512,
  minHeight: 512,
  maxWidth: 8_192,
  maxHeight: 8_192,
  maxPixels: 40_000_000,
});

const acceptedTypes = new Map([
  ["image/jpeg", "jpeg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

export class ConciergeImageValidationError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "ConciergeImageValidationError";
  }
}

export type SafeConciergeImage = Readonly<{
  bytes: Uint8Array;
  mimeType: "image/webp";
  extension: "webp";
  width: number;
  height: number;
  pixelCount: number;
  byteSize: number;
  contentHash: string;
}>;

export async function sanitizeConciergeCardImage(input: {
  bytes: Uint8Array;
  declaredMimeType: string;
  fileName: string;
}): Promise<SafeConciergeImage> {
  if (input.bytes.byteLength === 0 || input.bytes.byteLength > CONCIERGE_IMAGE_LIMITS.maxInputBytes) {
    throw new ConciergeImageValidationError("IMAGE_SIZE_INVALID");
  }
  const declaredFormat = acceptedTypes.get(input.declaredMimeType.toLowerCase());
  if (!declaredFormat) throw new ConciergeImageValidationError("IMAGE_MIME_UNSUPPORTED");
  const extension = input.fileName.toLowerCase().split(".").pop();
  const expectedExtension = declaredFormat === "jpeg" ? ["jpg", "jpeg"] : [declaredFormat];
  if (!extension || !expectedExtension.includes(extension)) {
    throw new ConciergeImageValidationError("IMAGE_EXTENSION_MISMATCH");
  }

  let metadata: Metadata;
  try {
    metadata = await sharp(input.bytes, { failOn: "error", limitInputPixels: CONCIERGE_IMAGE_LIMITS.maxPixels }).metadata();
  } catch {
    throw new ConciergeImageValidationError("IMAGE_DECODE_FAILED");
  }
  if (!metadata.format || metadata.format !== declaredFormat) {
    throw new ConciergeImageValidationError("IMAGE_SIGNATURE_MISMATCH");
  }
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  const pixelCount = width * height;
  if (width < CONCIERGE_IMAGE_LIMITS.minWidth || height < CONCIERGE_IMAGE_LIMITS.minHeight
      || width > CONCIERGE_IMAGE_LIMITS.maxWidth || height > CONCIERGE_IMAGE_LIMITS.maxHeight
      || pixelCount > CONCIERGE_IMAGE_LIMITS.maxPixels) {
    throw new ConciergeImageValidationError("IMAGE_DIMENSIONS_INVALID");
  }

  let encoded: Buffer;
  try {
    encoded = await sharp(input.bytes, { failOn: "error", limitInputPixels: CONCIERGE_IMAGE_LIMITS.maxPixels })
      .rotate()
      .webp({ quality: 88, effort: 4 })
      .toBuffer();
  } catch {
    throw new ConciergeImageValidationError("IMAGE_REENCODE_FAILED");
  }
  const finalMetadata = await sharp(encoded).metadata();
  const finalWidth = finalMetadata.width ?? width;
  const finalHeight = finalMetadata.height ?? height;
  return {
    bytes: encoded,
    mimeType: "image/webp",
    extension: "webp",
    width: finalWidth,
    height: finalHeight,
    pixelCount: finalWidth * finalHeight,
    byteSize: encoded.byteLength,
    contentHash: createHash("sha256").update(encoded).digest("hex"),
  };
}
