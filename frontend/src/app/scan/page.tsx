"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  AlertCircle,
  Barcode,
  Camera,
  Square,
  ShieldCheck,
  RefreshCw,
  VideoOff,
  Flashlight,
  ZoomIn,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { isValidBarcode, normalizeBarcode } from "@/lib/barcode";
import { useBarcodeScanner } from "@/hooks/useBarcodeScanner";

export default function ScanPage() {
  const [barcode, setBarcode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const {
    state: scannerState,
    errorMessage: scannerError,
    videoRef,
    attachVideoRef,
    startScanning,
    stopScanning,
    isVerifying,
    candidateBarcode,
    hasMultipleCameras,
    switchCamera,
    zoomLevel,
    maxZoom,
    applyZoom,
    hasTorch,
    torchOn,
    toggleTorch,
  } = useBarcodeScanner({
    fps: 10,
    confirmationWindowMs: 1200,
    onFound: (normalizedCode) => {
      router.push(`/product/bc-${normalizedCode}`);
    },
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Keep as string to preserve leading zeros
    const val = e.target.value.replace(/\s+/g, "");
    setBarcode(val);
    if (error) setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = barcode.trim();

    if (!cleanCode) {
      setError("Please enter a barcode.");
      return;
    }

    if (!/^\d+$/.test(cleanCode)) {
      setError("Barcodes must contain numbers only.");
      return;
    }

    if (![8, 12, 13].includes(cleanCode.length)) {
      setError("Barcode must be 8 (EAN-8), 12 (UPC-A), or 13 (EAN-13) digits long.");
      return;
    }

    if (!isValidBarcode(cleanCode)) {
      setError("Invalid check digit. Please double-check the digits under the barcode.");
      return;
    }

    const normalized = normalizeBarcode(cleanCode);
    router.push(`/product/bc-${normalized}`);
  };

  return (
    <div className="max-w-xl mx-auto py-10 px-4 sm:px-6 space-y-8">
      <div className="text-center space-y-2">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#1E5B45]/10 text-[#1E5B45]">
          <Barcode className="h-6 w-6" aria-hidden="true" />
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-[#1B2A22]">
          Scan or Enter Barcode
        </h1>
        <p className="text-sm text-[#5E6B63] max-w-md mx-auto">
          Look up packaged food nutrition and ingredients directly from Open Food Facts.
          Leading zeros are fully preserved.
        </p>
      </div>

      {/* SECTION 1: ON-DEVICE CAMERA SCANNER */}
      <Card className="border border-[#E4DEC3] bg-white shadow-xs overflow-hidden">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-[#1B2A22] flex items-center gap-2">
              <Camera className="h-5 w-5 text-[#1E5B45]" />
              Camera Scanner
            </h2>
            <span className="text-xs font-mono text-[#5E6B63] bg-[#FBF8F2] px-2 py-0.5 rounded border border-[#E4DEC3]">
              On-device only
            </span>
          </div>

          {/* Privacy statement before camera activation */}
          <div className="flex items-start gap-2 rounded-md bg-[#FBF8F2] p-3 text-xs text-[#5E6B63] border border-[#E4DEC3]">
            <ShieldCheck className="h-4 w-4 text-[#1E5B45] shrink-0 mt-0.5" />
            <p>
              The camera is used only on your device to read the barcode. Nothing is uploaded.
            </p>
          </div>

          {/* Scanner View Area */}
          {scannerState === "scanning" && (
            <div className="space-y-3">
              <div
                className={`relative overflow-hidden rounded-lg bg-black aspect-video max-h-72 w-full flex items-center justify-center border-2 transition-colors duration-200 ${
                  isVerifying ? "border-emerald-500 shadow-md shadow-emerald-500/20" : "border-[#1E5B45]"
                }`}
                aria-label="Camera scanner viewfinder"
              >
                <video
                  ref={attachVideoRef || videoRef}
                  autoPlay
                  playsInline
                  muted
                  onLoadedMetadata={(e) => {
                    const el = e.currentTarget;
                    el.play().catch(() => {});
                  }}
                  className="w-full h-full object-cover"
                />

                {/* Reticle / Guide Frame Overlay */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div
                    className={`relative w-64 h-36 border-2 rounded-lg shadow-sm transition-all duration-200 ${
                      isVerifying ? "border-emerald-400 bg-emerald-500/10 scale-[1.02]" : "border-white/80"
                    }`}
                  >
                    {/* Targeting Corner Highlights */}
                    <div
                      className={`absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 transition-colors ${
                        isVerifying ? "border-emerald-400" : "border-[#E3A02B]"
                      }`}
                    />
                    <div
                      className={`absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 transition-colors ${
                        isVerifying ? "border-emerald-400" : "border-[#E3A02B]"
                      }`}
                    />
                    <div
                      className={`absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 transition-colors ${
                        isVerifying ? "border-emerald-400" : "border-[#E3A02B]"
                      }`}
                    />
                    <div
                      className={`absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 transition-colors ${
                        isVerifying ? "border-emerald-400" : "border-[#E3A02B]"
                      }`}
                    />

                    {/* Scanning Laser Line */}
                    <div
                      className={`absolute inset-x-0 top-1/2 -translate-y-1/2 transition-colors ${
                        isVerifying
                          ? "border-b-2 border-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
                          : "border-b border-red-500/80"
                      }`}
                    />
                  </div>
                </div>

                <div className="absolute bottom-2 left-2 right-2 text-center pointer-events-none">
                  <span
                    className={`text-xs px-3 py-1 rounded-full backdrop-blur-xs font-medium transition-colors ${
                      isVerifying
                        ? "bg-emerald-950/80 text-emerald-300 border border-emerald-500/50"
                        : "bg-black/70 text-white"
                    }`}
                  >
                    {isVerifying && candidateBarcode
                      ? `Confirming barcode ${candidateBarcode}...`
                      : "Hold barcode steady inside the frame"}
                  </span>
                </div>
              </div>

              <div
                role="status"
                aria-live="polite"
                className={`text-xs text-center font-medium transition-colors ${
                  isVerifying ? "text-emerald-700 font-semibold" : "text-[#1E5B45]"
                }`}
              >
                {isVerifying
                  ? "Barcode detected! Verifying match..."
                  : "Scanning active. Searching for EAN/UPC barcode..."}
              </div>

              {/* Quick controls: Optical/Hardware Zoom and Flashlight */}
              <div className="flex items-center justify-between gap-2 px-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-[#5E6B63] flex items-center gap-1">
                    <ZoomIn className="h-3.5 w-3.5" />
                    Zoom:
                  </span>
                  {[1, 1.5, 2].map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => applyZoom(lvl)}
                      className={`text-xs px-2.5 py-1 rounded-md font-semibold transition-colors border ${
                        Math.abs(zoomLevel - lvl) < 0.1
                          ? "bg-[#1E5B45] text-white border-[#1E5B45]"
                          : "bg-white text-[#1B2A22] border-[#E4DEC3] hover:bg-[#FBF8F2]"
                      }`}
                    >
                      {lvl}x
                    </button>
                  ))}
                </div>

                {hasTorch && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={toggleTorch}
                    className={`text-xs h-7 px-2.5 border ${
                      torchOn
                        ? "bg-amber-100 text-amber-900 border-amber-300 font-semibold"
                        : "border-[#E4DEC3] text-[#1B2A22]"
                    }`}
                  >
                    <Flashlight className={`h-3.5 w-3.5 mr-1 ${torchOn ? "text-amber-600 fill-amber-500" : ""}`} />
                    {torchOn ? "Flash On" : "Flashlight"}
                  </Button>
                )}
              </div>

              <div className="flex gap-2">
                {hasMultipleCameras && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={switchCamera}
                    className="flex-1 border-[#E4DEC3] text-[#1B2A22] hover:bg-[#FBF8F2] text-xs h-10"
                  >
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                    Switch Camera
                  </Button>
                )}

                <Button
                  type="button"
                  variant="outline"
                  onClick={stopScanning}
                  className={`${hasMultipleCameras ? "flex-1" : "w-full"} border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800 text-xs h-10`}
                >
                  <Square className="h-4 w-4 mr-2 fill-current" />
                  Stop Camera
                </Button>
              </div>
            </div>
          )}

          {scannerState === "requesting-permission" && (
            <div className="p-6 text-center space-y-3 bg-[#FBF8F2] rounded-lg border border-[#E4DEC3]">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto text-[#1E5B45]" />
              <p className="text-sm font-medium text-[#1B2A22]">
                Requesting camera access...
              </p>
              <p className="text-xs text-[#5E6B63]">
                Please allow camera permissions in your browser prompt.
              </p>
            </div>
          )}

          {scannerState === "found" && (
            <div className="p-4 text-center bg-emerald-50 rounded-lg border border-emerald-200 text-emerald-800 space-y-1">
              <p className="text-sm font-bold">Barcode detected!</p>
              <p className="text-xs">Opening product details...</p>
            </div>
          )}

          {/* Specific error messages with manual entry reassurance */}
          {scannerState === "denied" && (
            <div
              role="alert"
              className="p-4 rounded-md bg-amber-50 border border-amber-200 text-amber-900 space-y-2 text-xs"
            >
              <div className="flex items-center gap-2 font-semibold">
                <VideoOff className="h-4 w-4 shrink-0 text-amber-700" />
                Camera permission was denied
              </div>
              <p>
                To enable scanning, allow camera access in your browser site permissions.
                Alternatively, you can type the barcode digits below.
              </p>
            </div>
          )}

          {scannerState === "no-camera" && (
            <div
              role="alert"
              className="p-4 rounded-md bg-stone-50 border border-stone-200 text-stone-800 space-y-2 text-xs"
            >
              <div className="flex items-center gap-2 font-semibold">
                <VideoOff className="h-4 w-4 shrink-0 text-stone-600" />
                No camera available
              </div>
              <p>
                A working camera was not detected on this device. Manual entry is ready below.
              </p>
            </div>
          )}

          {scannerState === "camera-in-use" && (
            <div
              role="alert"
              className="p-4 rounded-md bg-amber-50 border border-amber-200 text-amber-900 space-y-2 text-xs"
            >
              <div className="flex items-center gap-2 font-semibold">
                <VideoOff className="h-4 w-4 shrink-0 text-amber-700" />
                Camera is in use
              </div>
              <p>
                The camera seems to be in use by another tab or app. Please close other apps or use manual entry below.
              </p>
            </div>
          )}

          {scannerState === "insecure-context" && (
            <div
              role="alert"
              className="p-4 rounded-md bg-amber-50 border border-amber-200 text-amber-900 space-y-2 text-xs"
            >
              <div className="flex items-center gap-2 font-semibold">
                <AlertCircle className="h-4 w-4 shrink-0 text-amber-700" />
                Insecure context (HTTPS required)
              </div>
              <p>
                Camera access requires a secure connection (HTTPS or localhost). Please enter the barcode number manually below.
              </p>
            </div>
          )}

          {(scannerState === "decoder-failed" || scannerState === "error") && (
            <div
              role="alert"
              className="p-4 rounded-md bg-red-50 border border-red-200 text-red-900 space-y-2 text-xs"
            >
              <div className="flex items-center gap-2 font-semibold">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                {scannerError || "Unable to start camera"}
              </div>
              <div className="flex gap-2 pt-1">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={startScanning}
                  className="text-xs h-7"
                >
                  Retry Camera
                </Button>
              </div>
            </div>
          )}

          {/* Idle Start button */}
          {(scannerState === "idle" ||
            scannerState === "denied" ||
            scannerState === "no-camera" ||
            scannerState === "camera-in-use" ||
            scannerState === "insecure-context") && (
            <Button
              type="button"
              onClick={startScanning}
              className="w-full bg-[#1E5B45] hover:bg-[#164634] text-white font-medium py-2.5"
            >
              <Camera className="h-4 w-4 mr-2" />
              Start camera
            </Button>
          )}
        </CardContent>
      </Card>

      {/* SECTION 2: MANUAL ENTRY FORM (ALWAYS VISIBLE) */}
      <Card className="border border-[#E4DEC3] bg-white shadow-xs">
        <CardContent className="pt-6 space-y-4">
          <div className="border-b border-[#E4DEC3] pb-2">
            <h2 className="text-base font-semibold text-[#1B2A22]">
              Manual Barcode Entry
            </h2>
            <p className="text-xs text-[#5E6B63]">
              Always available as a direct fallback
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label
                htmlFor="barcode-input"
                className="block text-sm font-medium text-[#1B2A22]"
              >
                Barcode Number
              </label>
              <div className="relative">
                <Input
                  id="barcode-input"
                  name="barcode"
                  type="text"
                  inputMode="numeric"
                  placeholder="e.g. 5449000000996"
                  value={barcode}
                  onChange={handleInputChange}
                  className="pr-10 text-base font-mono tracking-wider"
                  autoComplete="off"
                  maxLength={13}
                  aria-invalid={error ? "true" : "false"}
                  aria-describedby={error ? "barcode-error" : undefined}
                />
              </div>
            </div>

            {error && (
              <div
                id="barcode-error"
                role="alert"
                className="flex items-center gap-2 text-xs font-medium text-red-600 bg-red-50 p-2.5 rounded-md border border-red-200"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-[#1E5B45] hover:bg-[#164634] text-white font-medium py-2.5"
            >
              <Search className="h-4 w-4 mr-2" />
              Look up Product
            </Button>
          </form>

          <div className="rounded-lg bg-[#FBF8F2] border border-[#E4DEC3] p-3 text-xs text-[#5E6B63] space-y-1.5">
            <p className="font-semibold text-[#1B2A22]">Tips for entering barcodes:</p>
            <ul className="list-disc pl-4 space-y-1">
              <li>Type all digits directly beneath the barcode stripes.</li>
              <li>Supports EAN-13 (13 digits), UPC-A (12 digits), and EAN-8 (8 digits).</li>
              <li>Leading zeros are preserved throughout the lookup.</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
