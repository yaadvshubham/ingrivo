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

  const wasmUrl =
    typeof window !== "undefined" && window.location?.origin
      ? `${window.location.origin}/wasm/zxing_reader.wasm`
      : "/wasm/zxing_reader.wasm";

  prepareZXingModule({
    fireImmediately: true,
    overrides: {
      locateFile: (path: string, prefix: string) => {
        if (path.endsWith(".wasm")) {
          return wasmUrl;
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
  "qr_code",
  "data_matrix",
];

// Reusable canvases to prevent GC spikes during high-frequency decode loops
let sharedCanvas: HTMLCanvasElement | null = null;
let sharedRoiCanvas: HTMLCanvasElement | null = null;

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

function getSharedRoiCanvas(width: number, height: number): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  if (!sharedRoiCanvas) {
    sharedRoiCanvas = document.createElement("canvas");
  }
  if (sharedRoiCanvas.width !== width || sharedRoiCanvas.height !== height) {
    sharedRoiCanvas.width = width;
    sharedRoiCanvas.height = height;
  }
  return sharedRoiCanvas;
}

// Singleton cache for browser native hardware GPU BarcodeDetector
let nativeDetectorInstance: {
  detect: (source: CanvasImageSource | ImageData | Blob) => Promise<DetectedBarcode[]>;
} | null = null;
let nativeDetectorTested = false;

async function getNativeDetector(): Promise<typeof nativeDetectorInstance | null> {
  if (typeof window === "undefined" || !("BarcodeDetector" in window)) {
    return null;
  }
  if (nativeDetectorTested) {
    return nativeDetectorInstance;
  }
  nativeDetectorTested = true;

  try {
    const WindowDetector = (window as unknown as { BarcodeDetector: typeof BarcodeDetector }).BarcodeDetector;
    if (!WindowDetector || WindowDetector === BarcodeDetector) {
      return null;
    }

    const supported: string[] = typeof (WindowDetector as unknown as { getSupportedFormats?: () => Promise<string[]> }).getSupportedFormats === "function"
      ? await (WindowDetector as unknown as { getSupportedFormats: () => Promise<string[]> }).getSupportedFormats()
      : [];

    const desiredFormats = ["ean_13", "ean_8", "upc_a", "upc_e", "qr_code", "code_128", "code_39", "itf"];
    const activeFormats = supported.length > 0 ? desiredFormats.filter((f) => supported.includes(f)) : desiredFormats;

    if (activeFormats.length > 0) {
      nativeDetectorInstance = new (WindowDetector as unknown as new (opts: { formats: string[] }) => {
        detect: (source: CanvasImageSource | ImageData | Blob) => Promise<DetectedBarcode[]>;
      })({
        formats: activeFormats,
      });
    }
  } catch {
    nativeDetectorInstance = null;
  }

  return nativeDetectorInstance;
}

/**
 * Ultra-fast Barcode & QR Detector engine.
 *
 * Engineered for sub-30ms instant snap scanning:
 * 1. Native hardware GPU Shape Detection API evaluated first
 * 2. Full resolution preservation up to 1280px (keeps 1D barcode lines sharp, not blurred)
 * 3. Multi-pass decoding:
 *    - Pass 1: LocalAverage binarizer for standard packaging
 *    - Pass 2: GlobalHistogram binarizer for shiny / reflective wrappers (Parle-G, chips, foil)
 *    - Pass 3: Dynamic range contrast enhancement for dim webcam feeds
 */
export class BarcodeDetector {
  private targetFormats: ReadInputBarcodeFormat[];

  constructor(options: BarcodeDetectorOptions = {}) {
    const rawFormats = options.formats || [
      "ean_13",
      "ean_8",
      "upc_a",
      "upc_e",
      "qr_code",
      "code_128",
      "code_39",
    ];

    const mapped: ReadInputBarcodeFormat[] = [];
    rawFormats.forEach((f) => {
      const clean = f.replace(/[-_]/g, "").toUpperCase();
      if (clean.includes("EAN") || clean.includes("UPC")) {
        if (!mapped.includes("EANUPC")) mapped.push("EANUPC");
        if ((clean === "EAN13" || clean === "EAN") && !mapped.includes("EAN13")) mapped.push("EAN13");
        if (clean === "EAN8" && !mapped.includes("EAN8")) mapped.push("EAN8");
        if (clean === "UPCA" && !mapped.includes("UPCA")) mapped.push("UPCA");
        if (clean === "UPCE" && !mapped.includes("UPCE")) mapped.push("UPCE");
      } else if (clean.includes("QR")) {
        if (!mapped.includes("QRCode")) mapped.push("QRCode");
      } else if (clean === "CODE128") {
        if (!mapped.includes("Code128")) mapped.push("Code128");
      } else if (clean === "CODE39") {
        if (!mapped.includes("Code39")) mapped.push("Code39");
      } else if (clean === "ITF") {
        if (!mapped.includes("ITF")) mapped.push("ITF");
      } else if (clean === "DATAMATRIX") {
        if (!mapped.includes("DataMatrix")) mapped.push("DataMatrix");
      }
    });

    if (!mapped.includes("EANUPC")) mapped.push("EANUPC");
    if (!mapped.includes("EAN13")) mapped.push("EAN13");
    if (!mapped.includes("UPCA")) mapped.push("UPCA");
    this.targetFormats = mapped;

    if (typeof window !== "undefined") {
      initZXingLocally();
    }
  }

  static async getSupportedFormats(): Promise<readonly string[]> {
    return SUPPORTED_RETAIL_FORMATS;
  }

  async detect(imageSource: CanvasImageSource | ImageData | Blob): Promise<DetectedBarcode[]> {
    if (!imageSource) return [];

    // TIER 1: Native hardware GPU Shape Detection API (Zero-copy, ~3-8ms)
    try {
      const native = await getNativeDetector();
      if (native) {
        const hits = await native.detect(imageSource);
        if (hits && hits.length > 0) {
          return hits;
        }
      }
    } catch {
      // Gracefully fall back to WebAssembly
    }

    if (typeof document === "undefined") {
      return [];
    }

    // Determine source dimensions
    let origWidth = 0;
    let origHeight = 0;

    if (imageSource instanceof HTMLVideoElement) {
      origWidth = imageSource.videoWidth;
      origHeight = imageSource.videoHeight;
    } else if (imageSource instanceof HTMLCanvasElement || imageSource instanceof ImageBitmap) {
      origWidth = imageSource.width;
      origHeight = imageSource.height;
    } else if (imageSource instanceof ImageData) {
      origWidth = imageSource.width;
      origHeight = imageSource.height;
    }

    if (origWidth === 0 || origHeight === 0) {
      return [];
    }

    // TIER 2: High-Resolution Preservation
    // Only downscale if larger than 1280px to preserve barcode stripe thickness
    const MAX_DIMENSION = 1280;
    let scaledWidth = origWidth;
    let scaledHeight = origHeight;

    if (scaledWidth > MAX_DIMENSION || scaledHeight > MAX_DIMENSION) {
      if (scaledWidth >= scaledHeight) {
        scaledHeight = Math.round((scaledHeight * MAX_DIMENSION) / scaledWidth);
        scaledWidth = MAX_DIMENSION;
      } else {
        scaledWidth = Math.round((scaledWidth * MAX_DIMENSION) / scaledHeight);
        scaledHeight = MAX_DIMENSION;
      }
    }

    const scaleX = origWidth / scaledWidth;
    const scaleY = origHeight / scaledHeight;

    const canvas = getSharedCanvas(scaledWidth, scaledHeight);
    if (!canvas) return [];

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return [];

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    if (imageSource instanceof ImageData) {
      ctx.putImageData(imageSource, 0, 0);
    } else {
      ctx.drawImage(imageSource as CanvasImageSource, 0, 0, scaledWidth, scaledHeight);
    }

    let foundResults = null;
    let offsetX = 0;
    let offsetY = 0;

    const fullData = ctx.getImageData(0, 0, scaledWidth, scaledHeight);

    // Pass 1: Full-frame scan with LocalAverage binarizer, rotation, inversion, and denoise
    try {
      const results = await readBarcodes(fullData, {
        tryHarder: true,
        tryRotate: true,
        tryInvert: true,
        tryDownscale: true,
        tryDenoise: true,
        binarizer: "LocalAverage",
        maxNumberOfSymbols: 1,
        formats: this.targetFormats.length > 0 ? this.targetFormats : undefined,
      });

      if (results && results.length > 0) {
        foundResults = results;
      }
    } catch (err) {
      // Continue to Pass 2
    }

    // Pass 2: GlobalHistogram binarizer (critical for glossy/reflective plastic wrappers like Parle-G)
    if (!foundResults || foundResults.length === 0) {
      try {
        const results = await readBarcodes(fullData, {
          tryHarder: true,
          tryRotate: true,
          tryInvert: true,
          tryDownscale: true,
          tryDenoise: true,
          binarizer: "GlobalHistogram",
          maxNumberOfSymbols: 1,
          formats: this.targetFormats.length > 0 ? this.targetFormats : undefined,
        });

        if (results && results.length > 0) {
          foundResults = results;
        }
      } catch (err) {
        // Continue to Pass 3
      }
    }

    // Pass 3: Contrast-stretched pass for dim/low-contrast webcam feeds
    if (!foundResults || foundResults.length === 0) {
      try {
        const roiX = Math.floor(scaledWidth * 0.05);
        const roiY = Math.floor(scaledHeight * 0.05);
        const roiW = Math.floor(scaledWidth * 0.90);
        const roiH = Math.floor(scaledHeight * 0.90);
        const roiCanvas = getSharedRoiCanvas(roiW, roiH);
        if (roiCanvas) {
          const roiCtx = roiCanvas.getContext("2d", { willReadFrequently: true });
          if (roiCtx) {
            roiCtx.drawImage(canvas, roiX, roiY, roiW, roiH, 0, 0, roiW, roiH);
            const roiData = roiCtx.getImageData(0, 0, roiW, roiH);
            const d = roiData.data;

            // Find min & max luminance
            let minL = 255;
            let maxL = 0;
            for (let i = 0; i < d.length; i += 16) {
              const l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
              if (l < minL) minL = l;
              if (l > maxL) maxL = l;
            }

            const range = maxL - minL;
            if (range > 20 && range < 225) {
              const factor = 255 / range;
              for (let i = 0; i < d.length; i += 4) {
                const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
                const stretched = Math.min(255, Math.max(0, (gray - minL) * factor));
                d[i] = stretched;
                d[i + 1] = stretched;
                d[i + 2] = stretched;
              }
              const stretchedResults = await readBarcodes(roiData, {
                tryHarder: true,
                tryRotate: true,
                tryInvert: true,
                tryDownscale: true,
                tryDenoise: true,
                maxNumberOfSymbols: 1,
                formats: this.targetFormats.length > 0 ? this.targetFormats : undefined,
              });
              if (stretchedResults && stretchedResults.length > 0) {
                foundResults = stretchedResults;
                offsetX = roiX;
                offsetY = roiY;
              }
            }
          }
        }
      } catch {
        // Ignored
      }
    }

    if (!foundResults || foundResults.length === 0) {
      return [];
    }

    // Map coordinates back to original video dimensions
    return foundResults.map((res) => {
      const pos = res.position;
      const rx1 = (pos.topLeft.x + offsetX) * scaleX;
      const ry1 = (pos.topLeft.y + offsetY) * scaleY;
      const rx2 = (pos.topRight.x + offsetX) * scaleX;
      const ry2 = (pos.topRight.y + offsetY) * scaleY;
      const rx3 = (pos.bottomRight.x + offsetX) * scaleX;
      const ry3 = (pos.bottomRight.y + offsetY) * scaleY;
      const rx4 = (pos.bottomLeft.x + offsetX) * scaleX;
      const ry4 = (pos.bottomLeft.y + offsetY) * scaleY;

      const l = Math.min(rx1, rx2, rx3, rx4);
      const t = Math.min(ry1, ry2, ry3, ry4);
      const r = Math.max(rx1, rx2, rx3, rx4);
      const b = Math.max(ry1, ry2, ry3, ry4);

      return {
        rawValue: res.text,
        format: (res.format || "ean_13").toLowerCase(),
        boundingBox: new DOMRectReadOnly(l, t, Math.max(0, r - l), Math.max(0, b - t)),
        cornerPoints: [
          { x: rx1, y: ry1 },
          { x: rx2, y: ry2 },
          { x: rx3, y: ry3 },
          { x: rx4, y: ry4 },
        ],
      };
    });
  }
}
