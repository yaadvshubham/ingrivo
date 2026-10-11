import { describe, it, expect } from "vitest";
import {
  validateImageFile,
  processAndDownscaleImage,
  rotateCanvas,
  MAX_FILE_SIZE_BYTES,
} from "@/lib/image-utils";

describe("Image Intake & Validation Tests", () => {
  it("Validates JPEG magic bytes correctly", async () => {
    // FF D8 FF E0
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
    const file = new File([bytes], "photo.jpg", { type: "image/jpeg" });
    const res = await validateImageFile(file);
    expect(res.valid).toBe(true);
    expect(res.mimeType).toBe("image/jpeg");
  });

  it("Validates PNG magic bytes correctly", async () => {
    // 89 50 4E 47 0D 0A 1A 0A
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
    const file = new File([bytes], "label.png", { type: "image/png" });
    const res = await validateImageFile(file);
    expect(res.valid).toBe(true);
    expect(res.mimeType).toBe("image/png");
  });

  it("Validates WebP magic bytes correctly", async () => {
    // RIFF .... WEBP
    const bytes = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, // RIFF
      0x20, 0x00, 0x00, 0x00, // size
      0x57, 0x45, 0x42, 0x50, // WEBP
    ]);
    const file = new File([bytes], "label.webp", { type: "image/webp" });
    const res = await validateImageFile(file);
    expect(res.valid).toBe(true);
    expect(res.mimeType).toBe("image/webp");
  });

  it("Rejects file exceeding 10 MB", async () => {
    const bigFile = new File([new Uint8Array(10)], "large.jpg", { type: "image/jpeg" });
    Object.defineProperty(bigFile, "size", { value: MAX_FILE_SIZE_BYTES + 1024 });

    const res = await validateImageFile(bigFile);
    expect(res.valid).toBe(false);
    expect(res.error).toContain("too large");
  });

  it("Detects HEIC/HEIF files and returns friendly JPEG/PNG prompt", async () => {
    // 1. By extension / MIME
    const heicFile = new File([new Uint8Array(20)], "iphone_photo.heic", { type: "image/heic" });
    const res = await validateImageFile(heicFile);
    expect(res.valid).toBe(false);
    expect(res.isHeic).toBe(true);
    expect(res.error).toContain("HEIC/HEIF photos are not supported directly by browsers");

    // 2. By signature: ftypheic
    const ftypBytes = new Uint8Array([
      0x00, 0x00, 0x00, 0x18,
      0x66, 0x74, 0x79, 0x70, // ftyp
      0x68, 0x65, 0x69, 0x63, // heic
    ]);
    const ftypFile = new File([ftypBytes], "raw_image.bin", { type: "application/octet-stream" });
    const res2 = await validateImageFile(ftypFile);
    expect(res2.valid).toBe(false);
    expect(res2.isHeic).toBe(true);
  });

  it("Rejects corrupt or unrecognized file signatures", async () => {
    const corruptBytes = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b]);
    const file = new File([corruptBytes], "random.bin", { type: "application/octet-stream" });
    const res = await validateImageFile(file);
    expect(res.valid).toBe(false);
    expect(res.error).toContain("Unsupported file format");
  });

  it("Downscales large images so long edge is at most 2000px and warns on low resolution", async () => {
    // Mock canvas source
    const sourceCanvas = document.createElement("canvas");
    sourceCanvas.width = 4000;
    sourceCanvas.height = 3000;

    const { canvas: downscaled, originalWidth, originalHeight } = await processAndDownscaleImage(sourceCanvas, 2000);
    expect(originalWidth).toBe(4000);
    expect(originalHeight).toBe(3000);
    expect(downscaled.width).toBe(2000);
    expect(downscaled.height).toBe(1500);

    // Low resolution check (<600px short edge)
    const smallCanvas = document.createElement("canvas");
    smallCanvas.width = 500;
    smallCanvas.height = 400;

    const { warning } = await processAndDownscaleImage(smallCanvas, 2000);
    expect(warning).toContain("Image resolution is low");
  });

  it("Rotates canvas dimensions by 90 degrees correctly", () => {
    const canvas = document.createElement("canvas");
    canvas.width = 800;
    canvas.height = 600;

    const rotated90 = rotateCanvas(canvas, 90);
    expect(rotated90.width).toBe(600);
    expect(rotated90.height).toBe(800);

    const rotated180 = rotateCanvas(canvas, 180);
    expect(rotated180.width).toBe(800);
    expect(rotated180.height).toBe(600);
  });
});
