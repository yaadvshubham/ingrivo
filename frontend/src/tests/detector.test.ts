import { describe, it, expect } from "vitest";
import { BarcodeDetector } from "@/lib/detector";

describe("BarcodeDetector Engine Tests", () => {
  it("exposes supported retail formats", async () => {
    const formats = await BarcodeDetector.getSupportedFormats();
    expect(formats).toContain("ean_13");
    expect(formats).toContain("upc_a");
    expect(formats).toContain("ean_8");
  });

  it("returns empty array when source is null or empty", async () => {
    const detector = new BarcodeDetector({ formats: ["ean_13"] });
    const results = await detector.detect(null as unknown as ImageData);
    expect(results).toEqual([]);
  });

  it("handles empty canvas gracefully without throwing", async () => {
    const detector = new BarcodeDetector();
    const canvas = document.createElement("canvas");
    canvas.width = 100;
    canvas.height = 100;
    const results = await detector.detect(canvas);
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(0);
  });
});
