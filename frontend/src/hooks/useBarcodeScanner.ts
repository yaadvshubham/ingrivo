"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { isValidBarcode, normalizeBarcode } from "@/lib/barcode";
import { BarcodeDetector, initZXingLocally } from "@/lib/detector";

export type ScannerState =
  | "idle"
  | "requesting-permission"
  | "scanning"
  | "denied"
  | "no-camera"
  | "insecure-context"
  | "camera-in-use"
  | "decoder-failed"
  | "found"
  | "error";

export interface UseBarcodeScannerOptions {
  onFound?: (code: string) => void;
  fps?: number; // Target decode rate: 5 to 10 fps
  confirmationWindowMs?: number; // Consecutive identical read window (~1.5s)
}

/**
 * Plays a pleasant soft audio chime on barcode confirmation.
 * Uses Web Audio API oscillator synthesis - no external audio files required.
 */
function playScanChime() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  } catch {
    // AudioContext may be restricted by user agent
  }
}

export function useBarcodeScanner(options: UseBarcodeScannerOptions = {}) {
  const { onFound, fps = 8, confirmationWindowMs = 1500 } = options;

  const [state, setState] = useState<ScannerState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [candidateBarcode, setCandidateBarcode] = useState<string | null>(null);
  const [hasMultipleCameras, setHasMultipleCameras] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<BarcodeDetector | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const availableCamerasRef = useRef<string[]>([]);
  const currentCameraIndexRef = useRef<number>(0);

  // Consecutive scan confirmation tracking: [code, timestamp]
  const lastScanRef = useRef<{ code: string; time: number } | null>(null);

  /**
   * Stops all active media stream tracks and resets video element srcObject.
   * Ensures browser camera hardware indicator turns off immediately.
   */
  const stopTracks = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach((track) => {
          track.stop();
        });
      } catch (err) {
        console.warn("Error stopping media tracks:", err);
      }
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsVerifying(false);
    setCandidateBarcode(null);
  }, []);

  /**
   * User-triggered Stop function.
   */
  const stopScanning = useCallback(() => {
    stopTracks();
    lastScanRef.current = null;
    setState("idle");
    setErrorMessage(null);
  }, [stopTracks]);

  /**
   * Callback ref to reliably attach media stream as soon as video DOM node mounts.
   * Fixes black screen issue when video element mounts after getUserMedia resolves.
   */
  const attachVideoRef = useCallback((element: HTMLVideoElement | null) => {
    videoRef.current = element;
    if (element && streamRef.current) {
      if (element.srcObject !== streamRef.current) {
        element.srcObject = streamRef.current;
      }
      element.play().catch((err) => {
        console.warn("Video play error on ref attach:", err);
      });
    }
  }, []);

  /**
   * Synchronize stream with video element when state transitions to 'scanning'
   */
  useEffect(() => {
    if (state === "scanning" && videoRef.current && streamRef.current) {
      const video = videoRef.current;
      if (video.srcObject !== streamRef.current) {
        video.srcObject = streamRef.current;
      }
      video.play().catch((err) => {
        console.warn("Video play error in effect synchronization:", err);
      });
    }
  }, [state]);

  /**
   * Starts camera scanning. Checks security context, requests permission with constraints,
   * configures local WASM detector, and starts frame decode loop.
   */
  const startScanning = useCallback(async () => {
    // 1. Pre-flight checks: Secure context and getUserMedia presence
    if (typeof window !== "undefined" && !window.isSecureContext) {
      setState("insecure-context");
      setErrorMessage(
        "Camera scanning requires a secure connection (HTTPS or localhost). Please enter barcode manually."
      );
      return;
    }

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== "function"
    ) {
      setState("no-camera");
      setErrorMessage(
        "Camera access is not supported by your browser. Please enter barcode manually."
      );
      return;
    }

    setState("requesting-permission");
    setErrorMessage(null);
    lastScanRef.current = null;
    setIsVerifying(false);
    setCandidateBarcode(null);

    try {
      // Primary constraints: full HD resolution preferred with continuous autofocus
      // High resolution is essential for small barcodes to be resolved clearly from distance!
      const constraints: MediaStreamConstraints = {
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 },
        },
      };

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (firstErr) {
        const errName = (firstErr as { name?: string })?.name || "";
        // Fallback to 720p or generic video if 1080p is rejected by hardware
        if (
          errName === "OverconstrainedError" ||
          errName === "ConstraintNotSatisfiedError" ||
          errName === "TypeError"
        ) {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              audio: false,
              video: {
                facingMode: { ideal: "environment" },
                width: { ideal: 1280 },
                height: { ideal: 720 },
              },
            });
          } catch {
            stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          }
        } else {
          throw firstErr;
        }
      }

      streamRef.current = stream;

      // Enable continuous hardware autofocus and auto-exposure if supported by device
      try {
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack && videoTrack.getCapabilities) {
          const caps = videoTrack.getCapabilities() as {
            focusMode?: string[];
            exposureMode?: string[];
          };
          const advancedConstraints: Record<string, unknown> = {};
          if (caps.focusMode && caps.focusMode.includes("continuous")) {
            advancedConstraints.focusMode = "continuous";
          }
          if (caps.exposureMode && caps.exposureMode.includes("continuous")) {
            advancedConstraints.exposureMode = "continuous";
          }
          if (Object.keys(advancedConstraints).length > 0) {
            videoTrack.applyConstraints({ advanced: [advancedConstraints] } as MediaTrackConstraints).catch(() => {});
          }
        }
      } catch {
        // Advanced hardware constraints non-fatal
      }

      // Detect multiple cameras for device toggle support
      try {
        if (navigator.mediaDevices.enumerateDevices) {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoDevices = devices.filter((d) => d.kind === "videoinput");
          availableCamerasRef.current = videoDevices.map((d) => d.deviceId);
          setHasMultipleCameras(videoDevices.length > 1);
        }
      } catch {
        // Enumerate devices is non-fatal
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch {
          // Play may throw in tests or autoplay restrictions
        }
      }

      // Initialize self-hosted WASM module
      initZXingLocally();

      // Configure BarcodeDetector ponyfill restricted strictly to retail formats
      try {
        detectorRef.current = new BarcodeDetector({
          formats: ["ean_13", "ean_8", "upc_a", "upc_e"],
        });
      } catch (detErr) {
        console.error("Failed to initialize BarcodeDetector:", detErr);
        stopTracks();
        setState("decoder-failed");
        setErrorMessage("Barcode decoder could not be initialized.");
        return;
      }

      setState("scanning");

      // Start decode loop: ~5 to 10 times per second (1000 / fps)
      const intervalMs = Math.round(1000 / Math.max(1, Math.min(fps, 10)));
      let isDetecting = false;

      intervalRef.current = setInterval(async () => {
        if (isDetecting || !videoRef.current || !detectorRef.current) {
          return;
        }

        // Ensure video is ready to be decoded
        if (
          videoRef.current.readyState < 2 ||
          videoRef.current.videoWidth === 0 ||
          videoRef.current.videoHeight === 0
        ) {
          return;
        }

        isDetecting = true;
        try {
          const results = await detectorRef.current.detect(videoRef.current);
          if (results && results.length > 0) {
            for (const result of results) {
              const rawVal = (result.rawValue || "").trim();
              if (!rawVal) continue;

              // Check digit validation
              if (!isValidBarcode(rawVal)) {
                continue;
              }

              const now = Date.now();
              const last = lastScanRef.current;

              // Two consecutive identical valid reads within ~1.5 seconds required
              if (
                last &&
                last.code === rawVal &&
                now - last.time <= confirmationWindowMs
              ) {
                // Success: Barcode confirmed
                playScanChime();
                stopTracks();
                setState("found");
                const normalized = normalizeBarcode(rawVal);
                if (onFound) {
                  onFound(normalized);
                }
                return;
              } else {
                // First valid read recorded - show visual confirmation state
                lastScanRef.current = { code: rawVal, time: now };
                setIsVerifying(true);
                setCandidateBarcode(rawVal);
              }
            }
          } else {
            // If verification window has expired without second read, clear candidate feedback
            if (lastScanRef.current && Date.now() - lastScanRef.current.time > confirmationWindowMs) {
              setIsVerifying(false);
              setCandidateBarcode(null);
            }
          }
        } catch (decErr) {
          console.warn("Decode loop error:", decErr);
        } finally {
          isDetecting = false;
        }
      }, intervalMs);
    } catch (err: unknown) {
      stopTracks();
      const error = err as { name?: string; message?: string };
      const name = error?.name || "";

      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setState("denied");
        setErrorMessage(
          "Camera permission was denied. You can enable camera access in your browser's site settings or continue with manual entry."
        );
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        setState("no-camera");
        setErrorMessage(
          "No camera was detected on this device. You can enter the barcode number manually below."
        );
      } else if (
        name === "NotReadableError" ||
        name === "TrackStartError" ||
        name === "AbortError"
      ) {
        setState("camera-in-use");
        setErrorMessage(
          "The camera is currently being used by another application or tab. Please close other apps or use manual entry."
        );
      } else {
        setState("error");
        setErrorMessage(
          error?.message ||
            "An error occurred while opening the camera. Please use manual entry below."
        );
      }
    }
  }, [fps, confirmationWindowMs, onFound, stopTracks]);

  /**
   * Switch between available cameras (e.g. front/back or external webcam)
   */
  const switchCamera = useCallback(async () => {
    if (availableCamerasRef.current.length < 2) return;
    currentCameraIndexRef.current =
      (currentCameraIndexRef.current + 1) % availableCamerasRef.current.length;
    const nextDeviceId = availableCamerasRef.current[currentCameraIndexRef.current];

    // Stop current stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: nextDeviceId } },
        audio: false,
      });
      streamRef.current = newStream;
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        videoRef.current.play().catch(() => {});
      }
    } catch {
      // Re-acquire default stream if deviceId switch failed
      startScanning();
    }
  }, [startScanning]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      stopTracks();
    };
  }, [stopTracks]);

  // Clean up when document becomes hidden (user switches tab or locks screen)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && state === "scanning") {
        stopScanning();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [state, stopScanning]);

  return {
    state,
    errorMessage,
    videoRef,
    attachVideoRef,
    startScanning,
    stopScanning,
    isVerifying,
    candidateBarcode,
    hasMultipleCameras,
    switchCamera,
  };
}
