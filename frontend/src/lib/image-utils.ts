export interface ImageValidationResult {
  valid: boolean;
  error?: string;
  isHeic?: boolean;
  warning?: string;
  width?: number;
  height?: number;
  mimeType?: string;
}

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MIN_RECOMMENDED_SHORT_EDGE_PX = 600;
export const MAX_LONG_EDGE_PX = 2000;

/**
 * Checks magic bytes of the given file/buffer.
 * Supported: JPEG (FF D8 FF), PNG (89 50 4E 47 0D 0A 1A 0A), WebP (RIFF .... WEBP)
 * Flags HEIC/HEIF signatures (ftypheic, ftypmif1, etc.)
 */
export async function validateImageFile(file: File): Promise<ImageValidationResult> {
  // Check file size
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maximum allowed size is 10 MB.`,
    };
  }

  // Check file extension / MIME for HEIC/HEIF
  const fileNameLower = file.name.toLowerCase();
  const fileTypeLower = (file.type || "").toLowerCase();
  if (
    fileNameLower.endsWith(".heic") ||
    fileNameLower.endsWith(".heif") ||
    fileTypeLower === "image/heic" ||
    fileTypeLower === "image/heif"
  ) {
    return {
      valid: false,
      isHeic: true,
      error: "HEIC/HEIF photos are not supported directly by browsers. Please take or upload a JPEG, PNG, or WebP photo.",
    };
  }

  // Read first 32 bytes for signature validation
  const headerSlice = file.slice(0, 32);
  const buffer = await headerSlice.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  if (bytes.length < 12) {
    return {
      valid: false,
      error: "File is too small or corrupt to be a valid image.",
    };
  }

  // 1. JPEG: FF D8 FF
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;

  // 2. PNG: 89 50 4E 47 0D 0A 1A 0A
  const isPng =
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a;

  // 3. WebP: RIFF [4 bytes] WEBP
  const isRiff =
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46;
  const isWebp =
    isRiff &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50;

  // 4. HEIC/HEIF signature check (ftypheic, ftypmif1, ftypmsf1)
  const isFtyp =
    bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70;
  if (isFtyp) {
    return {
      valid: false,
      isHeic: true,
      error: "HEIC/HEIF photos are not supported directly by browsers. Please take or upload a JPEG, PNG, or WebP photo.",
    };
  }

  if (!isJpeg && !isPng && !isWebp) {
    return {
      valid: false,
      error: "Unsupported file format. Please upload a standard JPEG, PNG, or WebP image.",
    };
  }

  const detectedMime = isJpeg ? "image/jpeg" : isPng ? "image/png" : "image/webp";

  return {
    valid: true,
    mimeType: detectedMime,
  };
}

/**
 * Loads an image from a Blob/File or Canvas, honoring EXIF orientation,
 * and downscales so the long edge is at most maxLongEdge (default 2000px).
 * Returns a HTMLCanvasElement containing the scaled image.
 */
export async function processAndDownscaleImage(
  imageSource: Blob | File | HTMLCanvasElement,
  maxLongEdge = MAX_LONG_EDGE_PX
): Promise<{
  canvas: HTMLCanvasElement;
  warning?: string;
  originalWidth: number;
  originalHeight: number;
}> {
  let sourceWidth = 0;
  let sourceHeight = 0;
  let drawSource: CanvasImageSource;

  if (imageSource instanceof HTMLCanvasElement) {
    sourceWidth = imageSource.width;
    sourceHeight = imageSource.height;
    drawSource = imageSource;
  } else if (typeof createImageBitmap === "function") {
    // createImageBitmap honoring EXIF orientation
    try {
      const bitmap = await createImageBitmap(imageSource, {
        imageOrientation: "from-image",
      });
      sourceWidth = bitmap.width;
      sourceHeight = bitmap.height;
      drawSource = bitmap;
    } catch {
      // Fallback to Image element
      const img = await loadImageElement(imageSource);
      sourceWidth = img.naturalWidth || img.width;
      sourceHeight = img.naturalHeight || img.height;
      drawSource = img;
    }
  } else {
    const img = await loadImageElement(imageSource);
    sourceWidth = img.naturalWidth || img.width;
    sourceHeight = img.naturalHeight || img.height;
    drawSource = img;
  }

  // Dimension check warning
  const shortEdge = Math.min(sourceWidth, sourceHeight);
  let warning: string | undefined;
  if (shortEdge < MIN_RECOMMENDED_SHORT_EDGE_PX) {
    warning = `Image resolution is low (${sourceWidth}×${sourceHeight}). Text detection may be less accurate. Filling the frame with the label is recommended.`;
  }

  // Calculate target dimensions
  const longEdge = Math.max(sourceWidth, sourceHeight);
  let scale = 1.0;
  if (longEdge > maxLongEdge) {
    scale = maxLongEdge / longEdge;
  }

  const targetWidth = Math.max(1, Math.round(sourceWidth * scale));
  const targetHeight = Math.max(1, Math.round(sourceHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Unable to create canvas 2D context");
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(drawSource, 0, 0, targetWidth, targetHeight);

  // If drawSource is an ImageBitmap, close it to free GPU memory
  if (drawSource && typeof (drawSource as ImageBitmap).close === "function") {
    (drawSource as ImageBitmap).close();
  }

  return {
    canvas,
    warning,
    originalWidth: sourceWidth,
    originalHeight: sourceHeight,
  };
}

/**
 * Rotates a canvas by 90 degrees clockwise (+90) or counterclockwise (-90).
 */
export function rotateCanvas(sourceCanvas: HTMLCanvasElement, degrees: 90 | -90 | 180 | 270): HTMLCanvasElement {
  const newCanvas = document.createElement("canvas");
  const normalizedDegrees = ((degrees % 360) + 360) % 360;

  if (normalizedDegrees === 90 || normalizedDegrees === 270) {
    newCanvas.width = sourceCanvas.height;
    newCanvas.height = sourceCanvas.width;
  } else {
    newCanvas.width = sourceCanvas.width;
    newCanvas.height = sourceCanvas.height;
  }

  const ctx = newCanvas.getContext("2d");
  if (!ctx) {
    throw new Error("Unable to create canvas 2D context for rotation");
  }

  ctx.save();
  if (normalizedDegrees === 90) {
    ctx.translate(newCanvas.width, 0);
    ctx.rotate((90 * Math.PI) / 180);
  } else if (normalizedDegrees === 180) {
    ctx.translate(newCanvas.width, newCanvas.height);
    ctx.rotate((180 * Math.PI) / 180);
  } else if (normalizedDegrees === 270) {
    ctx.translate(0, newCanvas.height);
    ctx.rotate((270 * Math.PI) / 180);
  }

  ctx.drawImage(sourceCanvas, 0, 0);
  ctx.restore();

  return newCanvas;
}

function loadImageElement(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image element from blob"));
    };
    img.src = url;
  });
}
