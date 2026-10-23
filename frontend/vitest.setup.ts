import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';

if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = function (contextType: string) {
    if (contextType === '2d') {
      return {
        drawImage: () => {},
        fillRect: () => {},
        clearRect: () => {},
        getImageData: () => ({ data: new Uint8ClampedArray(4) }),
        putImageData: () => {},
        createImageData: () => ({ data: new Uint8ClampedArray(4) }),
        setTransform: () => {},
        save: () => {},
        restore: () => {},
        translate: () => {},
        rotate: () => {},
        scale: () => {},
      } as unknown as CanvasRenderingContext2D;
    }
    return null;
  } as unknown as typeof HTMLCanvasElement.prototype.getContext;

  HTMLCanvasElement.prototype.toBlob = function (callback, type) {
    const blob = new Blob([new Uint8Array(10)], { type: type || 'image/jpeg' });
    Promise.resolve().then(() => callback(blob));
  };

  HTMLCanvasElement.prototype.toDataURL = function () {
    return 'data:image/jpeg;base64,12345';
  };
}

const mockCreateImageBitmap = async function () {
  return {
    width: 1200,
    height: 800,
    close: () => {},
  };
};

if (typeof window !== 'undefined') {
  (window as unknown as { createImageBitmap: unknown }).createImageBitmap = mockCreateImageBitmap;
}
if (typeof globalThis !== 'undefined') {
  (globalThis as unknown as { createImageBitmap: unknown }).createImageBitmap = mockCreateImageBitmap;
}

if (typeof globalThis.ImageData === 'undefined') {
  class MockImageData {
    data: Uint8ClampedArray;
    width: number;
    height: number;
    colorSpace: PredefinedColorSpace = 'srgb';

    constructor(width: number, height: number);
    constructor(data: Uint8ClampedArray, width: number, height?: number);
    constructor(arg1: number | Uint8ClampedArray, arg2: number, arg3?: number) {
      if (typeof arg1 === 'number') {
        this.width = arg1;
        this.height = arg2;
        this.data = new Uint8ClampedArray(this.width * this.height * 4);
      } else {
        this.data = arg1;
        this.width = arg2;
        this.height = arg3 ?? (arg1.length / (arg2 * 4));
      }
    }
  }
  globalThis.ImageData = MockImageData as unknown as typeof ImageData;
}

import { afterEach, beforeEach } from 'vitest';

beforeEach(() => {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage?.clear();
      window.sessionStorage?.clear();
    } catch {
      // ignore
    }
  }
});

afterEach(() => {
  cleanup();
  if (typeof window !== 'undefined') {
    try {
      window.localStorage?.clear();
      window.sessionStorage?.clear();
    } catch {
      // ignore
    }
  }
});

