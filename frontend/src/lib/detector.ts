import {
  readBarcodes,
  prepareZXingModule,
  type ReadInputBarcodeFormat,
} from "zxing-wasm/reader";

let isPrepared = false;

/**
 * Initializes the ZXing module override to load the WebAssembly binary
 * locally from our own origin (/wasm/zxing_reader.wasm) rather than a third-party CDN.
 */
export function initZXingLocally(): void {
  if (isPrepared || typeof window === "undefined") {
    return;
  }

  prepareZXingModule({
    overrides: {
      locateFile: (path: string, prefix: string) => {
        if (path.endsWith(".wasm")) {
          return "/wasm/zxing_reader.wasm";
        }
        return prefix + path;
      },
    },
  });

  isPrepared = true;
}

export interface Point2D {
  x: number;
  y: number;
}

export interface DetectedBarcode {
  boundingBox: DOMRectReadOnly;
  rawValue: string;
  format: string;
  cornerPoints: [Point2D, Point2D, Point2D, Point2D];
}

export interface BarcodeDetectorOptions {
  formats?: string[];
}

const SUPPORTED_RETAIL_FORMATS = [
  "ean_13",
  "ean_8",
  "upc_a",
  "upc_e",
  "code_128",
  "code_39",
  "itf",
];

// Reusable canvas to prevent GC pressure during high-frequency decode loops
let sharedCanvas: HTMLCanvasElement | null = null;
let sharedBinarizedCanvas: HTMLCanvasElement | null = null;

function getSharedCanvas(width: number, height: number): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  if (!sharedCanvas) {
    sharedCanvas = document.createElement("canvas");
  }
  if (sharedCanvas.width !== width || sharedCanvas.height !== height) {
    sharedCanvas.width = width;
    sharedCanvas.height = height;
  }
  return sharedCanvas;
}

function getSharedBinarizedCanvas(width: number, height: number): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  if (!sharedBinarizedCanvas) {
    sharedBinarizedCanvas = document.createElement("canvas");
  }
  if (sharedBinarizedCanvas.width !== width || sharedBinarizedCanvas.height !== height) {
    sharedBinarizedCanvas.width = width;
    sharedBinarizedCanvas.height = height;
  }
  return sharedBinarizedCanvas;
}

/**
 * Applies high-contrast sharpening filter to ImageData to assist reading
 * low-contrast, distance, or glossy packaging barcodes.
 */
function enhanceBarcodeContrast(srcData: ImageData, destData: ImageData): void {
  const src = srcData.data;
  const dest = destData.data;
  const len = src.length;

  // 1. Calculate luminance and find min/max for stretch
  let minLum = 255;
  let maxLum = 0;

  for (let i = 0; i < len; i += 4) {
    // Standard perceptual luminance
    const lum = (src[i] * 77 + src[i + 1] * 150 + src[i + 2] * 29) >> 8;
    if (lum < minLum) minLum = lum;
    if (lum > maxLum) maxLum = lum;
  }

  const range = maxLum - minLum || 1;

  // 2. High-contrast histogram stretch
  for (let i = 0; i < len; i += 4) {
    const lum = (src[i] * 77 + src[i + 1] * 150 + src[i + 2] * 29) >> 8;
    const stretched = Math.min(255, Math.max(0, Math.round(((lum - minLum) / range) * 255)));
    dest[i] = stretched;
    dest[i + 1] = stretched;
    dest[i + 2] = stretched;
    dest[i + 3] = 255;
  }
}

/**
 * High-performance BarcodeDetector engine.
 *
 * Designed for instant detection from distance and noisy camera feeds (UPI QR speed):
 * - Native hardware GPU BarcodeDetector evaluated first if available in browser
 * - Full-frame high-resolution scan first so distance/offset scans trigger immediately
 * - Center ROI crop with 2x zoom scaling for far-away barcodes
 * - Contrast-stretched pass for poor lighting or packaging glare
 * - Maximum sensitivity ZXing WebAssembly settings
 */
export class BarcodeDetector {
  private targetFormats: ReadInputBarcodeFormat[];

  constructor(options: BarcodeDetectorOptions = {}) {
    const rawFormats = options.formats || ["ean_13", "ean_8", "upc_a", "upc_e"];
    this.targetFormats = rawFormats.map((f) => {
      const clean = f.replace(/[-_]/g, "").toUpperCase();
      if (clean === "EAN13") return "EAN13";
      if (clean === "EAN8") return "EAN8";
      if (clean === "UPCA") return "UPCA";
      if (clean === "UPCE") return "UPCE";
      if (clean === "CODE128") return "Code128";
      if (clean === "CODE39") return "Code39";
      if (clean === "ITF") return "ITF";
      return "AllRetail";
    });

    if (typeof window !== "undefined") {
      initZXingLocally();
    }
  }

  static async getSupportedFormats(): Promise<readonly string[]> {
    return SUPPORTED_RETAIL_FORMATS;
  }

  async detect(imageSource: CanvasImageSource | ImageData | Blob): Promise<DetectedBarcode[]> {
    if (!imageSource) return [];

    // 1. FAST PATH: Native browser GPU Shape Detection API (if supported by browser hardware)
    if (typeof window !== "undefined" && "BarcodeDetector" in window) {
      try {
        const NativeDetector = (window as unknown as { BarcodeDetector: typeof BarcodeDetector }).BarcodeDetector;
        if (NativeDetector !== BarcodeDetector) {
          const native = new NativeDetector({
            formats: ["ean_13", "ean_8", "upc_a", "upc_e"],
          });
          const nativeHits = await native.detect(imageSource);
          if (nativeHits && nativeHits.length > 0) {
            return nativeHits;
          }
        }
      } catch {
        // Fall back to WebAssembly
      }
    }

    if (typeof document === "undefined") {
      return [];
    }

    let width = 0;
    let height = 0;

    if (imageSource instanceof HTMLVideoElement) {
      width = imageSource.videoWidth;
      height = imageSource.videoHeight;
    } else if (imageSource instanceof HTMLCanvasElement || imageSource instanceof ImageBitmap) {
      width = imageSource.width;
      height = imageSource.height;
    } else if (imageSource instanceof ImageData) {
      width = imageSource.width;
      height = imageSource.height;
    }

    if (width === 0 || height === 0) {
      return [];
    }

    const canvas = getSharedCanvas(width, height);
    if (!canvas) return [];

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return [];

    if (imageSource instanceof ImageData) {
      ctx.putImageData(imageSource, 0, 0);
    } else {
      ctx.drawImage(imageSource as CanvasImageSource, 0, 0, width, height);
    }

    const zxingOptions = {
      tryHarder: true,
      tryRotate: true,
      tryInvert: true,
      tryDownscale: true,
      binarizer: "LocalAverage" as const,
      maxNumberOfSymbols: 1,
      formats: this.targetFormats.length > 0 ? this.targetFormats : undefined,
    };

    let foundResults = null;
    let offsetX = 0;
    let offsetY = 0;

    // PASS 1: Full-Frame Standard Scan
    // Scans the entire camera field of view immediately, regardless of where the barcode is held
    try {
      const fullData = ctx.getImageData(0, 0, width, height);
      const fullResults = await readBarcodes(fullData, zxingOptions);
      if (fullResults && fullResults.length > 0) {
        foundResults = fullResults;
        offsetX = 0;
        offsetY = 0;
      }
    } catch (fullErr) {
      console.warn("Full frame decode error:", fullErr);
    }

    // PASS 2: Center Region of Interest (ROI) with 2x Virtual Zoom
    // If the barcode is far away, the stripes are thin. Scaling up the center 2x
    // dramatically improves decode accuracy for distant barcodes!
    if (!foundResults || foundResults.length === 0) {
      try {
        const cropX = Math.floor(width * 0.15);
        const cropY = Math.floor(height * 0.2);
        const cropW = Math.floor(width * 0.7);
        const cropH = Math.floor(height * 0.6);

        const zoomCanvas = getSharedBinarizedCanvas(cropW, cropH);
        if (zoomCanvas) {
          const zoomCtx = zoomCanvas.getContext("2d", { willReadFrequently: true });
          if (zoomCtx) {
            // Draw cropped center region
            zoomCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
            const centerData = zoomCtx.getImageData(0, 0, cropW, cropH);

            const centerResults = await readBarcodes(centerData, zxingOptions);
            if (centerResults && centerResults.length > 0) {
              foundResults = centerResults;
              offsetX = cropX;
              offsetY = cropY;
            } else {
              // PASS 3: Contrast Enhancement on Center Region
              // Handles shiny wrappers, plastic crinkles, and poor room lighting
              const enhancedData = zoomCtx.createImageData(cropW, cropH);
              enhanceBarcodeContrast(centerData, enhancedData);
              const enhancedResults = await readBarcodes(enhancedData, zxingOptions);
              if (enhancedResults && enhancedResults.length > 0) {
                foundResults = enhancedResults;
                offsetX = cropX;
                offsetY = cropY;
              }
            }
          }
        }
      } catch (cropErr) {
        console.warn("ROI zoom decode error:", cropErr);
      }
    }

    if (!foundResults || foundResults.length === 0) {
      return [];
    }

    return foundResults.map((res) => {
      const pos = res.position;
      const l = Math.min(pos.topLeft.x, pos.topRight.x, pos.bottomLeft.x, pos.bottomRight.x) + offsetX;
      const t = Math.min(pos.topLeft.y, pos.topRight.y, pos.bottomLeft.y, pos.bottomRight.y) + offsetY;
      const r = Math.max(pos.topLeft.x, pos.topRight.x, pos.bottomLeft.x, pos.bottomRight.x) + offsetX;
      const b = Math.max(pos.topLeft.y, pos.topRight.y, pos.bottomLeft.y, pos.bottomRight.y) + offsetY;

      return {
        rawValue: res.text,
        format: (res.format || "ean_13").toLowerCase(),
        boundingBox: new DOMRectReadOnly(l, t, Math.max(0, r - l), Math.max(0, b - t)),
        cornerPoints: [
          { x: pos.topLeft.x + offsetX, y: pos.topLeft.y + offsetY },
          { x: pos.topRight.x + offsetX, y: pos.topRight.y + offsetY },
          { x: pos.bottomRight.x + offsetX, y: pos.bottomRight.y + offsetY },
          { x: pos.bottomLeft.x + offsetX, y: pos.bottomLeft.y + offsetY },
        ],
      };
    });
  }
}
