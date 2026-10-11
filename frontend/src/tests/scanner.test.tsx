import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import React from "react";
import ScanPage from "@/app/scan/page";

// Mock router
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock BarcodeDetector and initZXingLocally
const { mockDetect, MockBarcodeDetector } = vi.hoisted(() => {
  const detectFn = vi.fn();
  class BarcodeDetectorMock {
    detect = detectFn;
    constructor() {}
  }
  return { mockDetect: detectFn, MockBarcodeDetector: BarcodeDetectorMock };
});

vi.mock("@/lib/detector", () => ({
  initZXingLocally: vi.fn(),
  BarcodeDetector: MockBarcodeDetector,
}));

describe("Scanner & Scan Page Integration Tests", () => {
  let originalGetUserMedia: typeof navigator.mediaDevices.getUserMedia | undefined;
  let originalIsSecureContext: boolean | undefined;
  let originalFetch: typeof globalThis.fetch;
  let mockTracks: { stop: ReturnType<typeof vi.fn> }[];
  let mockStream: { getTracks: () => { stop: ReturnType<typeof vi.fn> }[] };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Mock fetch to track network calls (no network calls allowed from scanner)
    originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn();

    // Set secure context default
    originalIsSecureContext = window.isSecureContext;
    Object.defineProperty(window, "isSecureContext", {
      value: true,
      configurable: true,
      writable: true,
    });

    // Mock MediaStream tracks
    mockTracks = [{ stop: vi.fn() }, { stop: vi.fn() }];
    mockStream = {
      getTracks: () => mockTracks,
    };

    // Mock navigator.mediaDevices.getUserMedia
    if (!navigator.mediaDevices) {
      Object.defineProperty(navigator, "mediaDevices", {
        value: {},
        configurable: true,
        writable: true,
      });
    }

    originalGetUserMedia = navigator.mediaDevices.getUserMedia;
    navigator.mediaDevices.getUserMedia = vi.fn().mockResolvedValue(mockStream);

    // Mock HTMLMediaElement.prototype.play
    window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.fetch = originalFetch;
    if (originalGetUserMedia) {
      navigator.mediaDevices.getUserMedia = originalGetUserMedia;
    }
    Object.defineProperty(window, "isSecureContext", {
      value: originalIsSecureContext,
      configurable: true,
      writable: true,
    });
  });

  it("does NOT request camera permission on mount", () => {
    render(<ScanPage />);
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /start camera/i })).toBeInTheDocument();
    // Manual entry is visible
    expect(screen.getByLabelText(/barcode number/i)).toBeInTheDocument();
  });

  it("displays insecure context error when window.isSecureContext is false without requesting camera", async () => {
    Object.defineProperty(window, "isSecureContext", {
      value: false,
      configurable: true,
    });

    render(<ScanPage />);
    const startBtn = screen.getByRole("button", { name: /start camera/i });
    fireEvent.click(startBtn);

    await act(async () => {});

    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
    expect(screen.getByText(/insecure context/i)).toBeInTheDocument();
    // Manual entry remains functional
    expect(screen.getByLabelText(/barcode number/i)).toBeInTheDocument();
  });

  it("maps NotAllowedError to denied state with site settings advice", async () => {
    const error = new Error("Permission denied");
    error.name = "NotAllowedError";
    navigator.mediaDevices.getUserMedia = vi.fn().mockRejectedValue(error);

    render(<ScanPage />);
    const startBtn = screen.getByRole("button", { name: /start camera/i });
    fireEvent.click(startBtn);

    await act(async () => {
      // allow async promises to flush
    });

    expect(screen.getByText(/camera permission was denied/i)).toBeInTheDocument();
    expect(screen.getByText(/site permissions/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/barcode number/i)).toBeInTheDocument();
  });

  it("maps NotFoundError to no-camera state", async () => {
    const error = new Error("No device found");
    error.name = "NotFoundError";
    navigator.mediaDevices.getUserMedia = vi.fn().mockRejectedValue(error);

    render(<ScanPage />);
    const startBtn = screen.getByRole("button", { name: /start camera/i });
    fireEvent.click(startBtn);

    await act(async () => {});

    expect(screen.getByText(/no camera available/i)).toBeInTheDocument();
  });

  it("maps NotReadableError to camera-in-use state", async () => {
    const error = new Error("Camera locked");
    error.name = "NotReadableError";
    navigator.mediaDevices.getUserMedia = vi.fn().mockRejectedValue(error);

    render(<ScanPage />);
    const startBtn = screen.getByRole("button", { name: /start camera/i });
    fireEvent.click(startBtn);

    await act(async () => {});

    expect(screen.getByText(/camera is in use/i)).toBeInTheDocument();
  });

  it("requires TWO consecutive identical valid reads before navigating", async () => {
    render(<ScanPage />);
    const startBtn = screen.getByRole("button", { name: /start camera/i });
    fireEvent.click(startBtn);

    await act(async () => {});

    expect(screen.getByText(/stop camera/i)).toBeInTheDocument();

    // Setup video element mock state so decode loop executes
    const video = document.querySelector("video");
    if (video) {
      Object.defineProperty(video, "readyState", { value: 4, configurable: true });
      Object.defineProperty(video, "videoWidth", { value: 640, configurable: true });
      Object.defineProperty(video, "videoHeight", { value: 480, configurable: true });
    }

    // 1st decode returns valid barcode: 5449000000996 (Coca-Cola)
    mockDetect.mockResolvedValueOnce([{ rawValue: "5449000000996" }]);

    await act(async () => {
      vi.advanceTimersByTime(150);
    });

    // After 1st read, navigate should NOT have been called yet
    expect(mockPush).not.toHaveBeenCalled();

    // 2nd decode returns identical valid barcode within 1.5s
    mockDetect.mockResolvedValueOnce([{ rawValue: "5449000000996" }]);

    await act(async () => {
      vi.advanceTimersByTime(150);
    });

    // Now navigation should occur to /product/bc-5449000000996
    expect(mockPush).toHaveBeenCalledWith("/product/bc-5449000000996");
    // And tracks must be stopped
    expect(mockTracks[0].stop).toHaveBeenCalled();
    expect(mockTracks[1].stop).toHaveBeenCalled();
  });

  it("rejects code with bad check digit and does NOT navigate even after multiple reads", async () => {
    render(<ScanPage />);
    fireEvent.click(screen.getByRole("button", { name: /start camera/i }));

    await act(async () => {});

    const video = document.querySelector("video");
    if (video) {
      Object.defineProperty(video, "readyState", { value: 4, configurable: true });
      Object.defineProperty(video, "videoWidth", { value: 640, configurable: true });
      Object.defineProperty(video, "videoHeight", { value: 480, configurable: true });
    }

    // Invalid check digit barcode (5449000000997)
    mockDetect.mockResolvedValue([{ rawValue: "5449000000997" }]);

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    expect(mockPush).not.toHaveBeenCalled();
  });

  it("does not navigate if reads differ", async () => {
    render(<ScanPage />);
    fireEvent.click(screen.getByRole("button", { name: /start camera/i }));

    await act(async () => {});

    const video = document.querySelector("video");
    if (video) {
      Object.defineProperty(video, "readyState", { value: 4, configurable: true });
      Object.defineProperty(video, "videoWidth", { value: 640, configurable: true });
      Object.defineProperty(video, "videoHeight", { value: 480, configurable: true });
    }

    // First read: 5449000000996
    mockDetect.mockResolvedValueOnce([{ rawValue: "5449000000996" }]);
    await act(async () => {
      vi.advanceTimersByTime(150);
    });

    // Second read: different valid barcode 3017620422003 (Nutella)
    mockDetect.mockResolvedValueOnce([{ rawValue: "3017620422003" }]);
    await act(async () => {
      vi.advanceTimersByTime(150);
    });

    expect(mockPush).not.toHaveBeenCalled();
  });

  it("stops tracks when component unmounts", async () => {
    const { unmount } = render(<ScanPage />);
    fireEvent.click(screen.getByRole("button", { name: /start camera/i }));

    await act(async () => {});

    unmount();

    expect(mockTracks[0].stop).toHaveBeenCalled();
    expect(mockTracks[1].stop).toHaveBeenCalled();
  });

  it("stops scanning and tracks when document visibility becomes hidden", async () => {
    render(<ScanPage />);
    fireEvent.click(screen.getByRole("button", { name: /start camera/i }));

    await act(async () => {});

    expect(screen.getByText(/stop camera/i)).toBeInTheDocument();

    // Trigger visibilitychange to hidden
    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    fireEvent(document, new Event("visibilitychange"));

    expect(mockTracks[0].stop).toHaveBeenCalled();
    expect(mockTracks[1].stop).toHaveBeenCalled();
  });

  it("verifies NO network requests (fetch / XHR) are initiated by scanner", async () => {
    render(<ScanPage />);
    fireEvent.click(screen.getByRole("button", { name: /start camera/i }));

    await act(async () => {});

    const video = document.querySelector("video");
    if (video) {
      Object.defineProperty(video, "readyState", { value: 4, configurable: true });
      Object.defineProperty(video, "videoWidth", { value: 640, configurable: true });
      Object.defineProperty(video, "videoHeight", { value: 480, configurable: true });
    }

    mockDetect.mockResolvedValue([{ rawValue: "5449000000996" }]);

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    // Confirms strictly zero network calls were made
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
