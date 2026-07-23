import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  ConciergeImageValidationError,
  sanitizeConciergeCardImage,
} from "../../apps/web/src/server/concierge-card-image";

describe("concierge card image safety", () => {
  it("decodes and re-encodes an accepted image as metadata-free WebP", async () => {
    const source = await sharp({
      create: { width: 512, height: 512, channels: 3, background: "#cc7790" },
    })
      .jpeg()
      .withExif({ IFD0: { Artist: "private metadata" } })
      .toBuffer();
    const result = await sanitizeConciergeCardImage({
      bytes: source,
      declaredMimeType: "image/jpeg",
      fileName: "card.jpg",
    });
    const metadata = await sharp(result.bytes).metadata();
    expect(result.mimeType).toBe("image/webp");
    expect(result.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(metadata.format).toBe("webp");
    expect(metadata.exif).toBeUndefined();
  });

  it("rejects a forged MIME type", async () => {
    const png = await sharp({
      create: { width: 512, height: 512, channels: 3, background: "#ffffff" },
    })
      .png()
      .toBuffer();
    await expect(
      sanitizeConciergeCardImage({
        bytes: png,
        declaredMimeType: "image/jpeg",
        fileName: "card.jpg",
      }),
    ).rejects.toMatchObject({ code: "IMAGE_SIGNATURE_MISMATCH" } satisfies Partial<ConciergeImageValidationError>);
  });

  it("rejects images below the minimum dimensions", async () => {
    const png = await sharp({
      create: { width: 128, height: 128, channels: 3, background: "#ffffff" },
    })
      .png()
      .toBuffer();
    await expect(
      sanitizeConciergeCardImage({
        bytes: png,
        declaredMimeType: "image/png",
        fileName: "card.png",
      }),
    ).rejects.toMatchObject({ code: "IMAGE_DIMENSIONS_INVALID" } satisfies Partial<ConciergeImageValidationError>);
  });
});
