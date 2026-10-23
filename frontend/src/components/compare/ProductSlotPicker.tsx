"use client";

import React, { useState, useMemo } from "react";
import Image from "next/image";
import {
  Search,
  ScanBarcode,
  Camera,
  X,
  AlertCircle,
  History as HistoryIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { isValidBarcode, normalizeBarcode } from "@/lib/barcode";
import { searchProducts, ApiError } from "@/lib/api-client";
import { ProductSummary } from "@/lib/schemas/search";
import { listAllLabelProducts } from "@/lib/label-store";
import { getHistory } from "@/lib/history-store";
import { useBarcodeScanner } from "@/hooks/useBarcodeScanner";
import { cn } from "@/lib/utils";

interface ProductSlotPickerProps {
  slotLabel: "Product A" | "Product B";
  currentRef?: string | null;
  summary?: {
    name?: string | null;
    brand?: string | null;
    image_url?: string | null;
    basis?: string;
  } | null;
  onSelect: (ref: string) => void;
  onClear: () => void;
}

export function ProductSlotPicker({
  slotLabel,
  currentRef,
  summary,
  onSelect,
  onClear,
}: ProductSlotPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"recent" | "barcode" | "search" | "label">("recent");

  // Barcode tab state
  const [barcodeInput, setBarcodeInput] = useState("");
  const [barcodeError, setBarcodeError] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);

  // Search tab state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ProductSummary[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Recent history tab state
  const recentHistory = useMemo(() => {
    if (isOpen && activeTab === "recent") {
      return getHistory();
    }
    return [];
  }, [isOpen, activeTab]);

  // Label tab state derived synchronously from store
  const labelProducts = useMemo(() => {
    if (isOpen && activeTab === "label") {
      return listAllLabelProducts();
    }
    return [];
  }, [isOpen, activeTab]);

  const {
    attachVideoRef,
    startScanning,
    stopScanning,
    errorMessage: scannerError,
  } = useBarcodeScanner({
    onFound: (normalizedCode) => {
      stopScanning();
      setIsCameraActive(false);
      onSelect(`bc-${normalizedCode}`);
      setIsOpen(false);
    },
  });

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = barcodeInput.trim();
    if (!clean) {
      setBarcodeError("Please enter a barcode.");
      return;
    }
    if (!/^\d+$/.test(clean)) {
      setBarcodeError("Barcode must contain digits only.");
      return;
    }
    if (!isValidBarcode(clean)) {
      setBarcodeError("Invalid barcode checksum or length (EAN-8, UPC-A, EAN-13).");
      return;
    }
    const normalized = normalizeBarcode(clean);
    onSelect(`bc-${normalized}`);
    setIsOpen(false);
  };

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchError("Please enter at least 2 characters.");
      return;
    }
    setSearchLoading(true);
    setSearchError(null);
    try {
      const res = await searchProducts(q, 1);
      setSearchResults(res.results);
      if (res.results.length === 0) {
        setSearchError("No products found matching your search.");
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setSearchError(err.message);
      } else {
        setSearchError("Error searching products.");
      }
    } finally {
      setSearchLoading(false);
    }
  };

  const handleStartCamera = () => {
    setIsCameraActive(true);
    startScanning();
  };

  const handleStopCamera = () => {
    stopScanning();
    setIsCameraActive(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-[#5E6B63]">
          {slotLabel}
        </span>
        {currentRef && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-stone-500 hover:text-red-700 underline"
          >
            Clear slot
          </button>
        )}
      </div>

      {currentRef && summary ? (
        <Card className="border border-[#E4DEC3] bg-white p-3.5 shadow-2xs">
          <div className="flex items-center gap-3">
            {summary.image_url ? (
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md border border-[#E4DEC3] bg-[#FBF8F2]">
                <Image
                  src={summary.image_url}
                  alt={summary.name || "Product"}
                  fill
                  className="object-contain"
                  unoptimized
                />
              </div>
            ) : (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-[#E4DEC3] bg-[#FBF8F2] text-xs text-[#5E6B63]">
                No img
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h4 className="truncate text-sm font-bold text-[#1B2A22]">
                {summary.name || "Unnamed Product"}
              </h4>
              <p className="truncate text-xs text-[#5E6B63]">
                {summary.brand || "Brand not stated"} · {summary.basis}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsOpen(true)}
              className="text-xs shrink-0"
            >
              Change
            </Button>
          </div>
        </Card>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={() => setIsOpen(true)}
          className="w-full justify-center gap-2 border-dashed border-[#E4DEC3] py-6 text-sm text-[#1E5B45] hover:bg-[#1E5B45]/5 hover:border-[#1E5B45]"
        >
          <ScanBarcode className="h-4 w-4" />
          <span>Select {slotLabel}</span>
        </Button>
      )}

      {/* Modal Picker */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Select ${slotLabel}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-2xs"
        >
          <div className="w-full max-w-lg rounded-xl border border-[#E4DEC3] bg-white shadow-xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#E4DEC3] px-5 py-4">
              <h3 className="text-lg font-bold text-[#1B2A22]">Select {slotLabel}</h3>
              <button
                type="button"
                onClick={() => {
                  handleStopCamera();
                  setIsOpen(false);
                }}
                className="rounded-md p-1.5 text-[#5E6B63] hover:bg-[#EFECE4]"
                aria-label="Close modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-[#E4DEC3] bg-[#FBF8F2] overflow-x-auto">
              <button
                type="button"
                onClick={() => {
                  handleStopCamera();
                  setActiveTab("recent");
                }}
                className={cn(
                  "flex-1 min-w-[80px] py-3 text-xs font-semibold text-center border-b-2 transition-colors",
                  activeTab === "recent"
                    ? "border-[#1E5B45] text-[#1E5B45] bg-white"
                    : "border-transparent text-[#5E6B63] hover:text-[#1B2A22]"
                )}
              >
                Recent
              </button>
              <button
                type="button"
                onClick={() => {
                  handleStopCamera();
                  setActiveTab("barcode");
                }}
                className={cn(
                  "flex-1 min-w-[120px] py-3 text-xs font-semibold text-center border-b-2 transition-colors",
                  activeTab === "barcode"
                    ? "border-[#1E5B45] text-[#1E5B45] bg-white"
                    : "border-transparent text-[#5E6B63] hover:text-[#1B2A22]"
                )}
              >
                Barcode Entry / Scan
              </button>
              <button
                type="button"
                onClick={() => {
                  handleStopCamera();
                  setActiveTab("search");
                }}
                className={cn(
                  "flex-1 min-w-[110px] py-3 text-xs font-semibold text-center border-b-2 transition-colors",
                  activeTab === "search"
                    ? "border-[#1E5B45] text-[#1E5B45] bg-white"
                    : "border-transparent text-[#5E6B63] hover:text-[#1B2A22]"
                )}
              >
                Search Database
              </button>
              <button
                type="button"
                onClick={() => {
                  handleStopCamera();
                  setActiveTab("label");
                }}
                className={cn(
                  "flex-1 min-w-[100px] py-3 text-xs font-semibold text-center border-b-2 transition-colors",
                  activeTab === "label"
                    ? "border-[#1E5B45] text-[#1E5B45] bg-white"
                    : "border-transparent text-[#5E6B63] hover:text-[#1B2A22]"
                )}
              >
                Session Labels
              </button>
            </div>

            <div className="p-5 flex-1 overflow-y-auto space-y-4">
              {/* Tab 0: Recent History */}
              {activeTab === "recent" && (
                <div className="space-y-3">
                  <p className="text-xs text-[#5E6B63]">
                    Select a previously viewed or reviewed product from your local history:
                  </p>
                  {recentHistory.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-[#E4DEC3] p-8 text-center space-y-2">
                      <HistoryIcon className="h-6 w-6 text-[#5E6B63] mx-auto opacity-50" aria-hidden="true" />
                      <p className="text-xs text-[#5E6B63]">
                        No scan history found in this browser. Use Barcode or Search to find a product.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {recentHistory.map((item) => (
                        <div
                          key={item.ref}
                          onClick={() => {
                            onSelect(item.ref);
                            setIsOpen(false);
                          }}
                          className="flex items-center justify-between p-2.5 rounded-lg border border-[#E4DEC3] hover:bg-[#1E5B45]/5 cursor-pointer transition-colors"
                        >
                          <div className="min-w-0 flex-1 pr-2">
                            <p className="text-sm font-semibold text-[#1B2A22] truncate">
                              {item.title || "Unnamed Product"}
                            </p>
                            <p className="text-xs text-[#5E6B63] truncate">
                              {item.brand || "Brand not stated"} · {item.ref}
                            </p>
                          </div>
                          <Button size="sm" variant="ghost" className="text-xs text-[#1E5B45] shrink-0">
                            Select
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {/* Tab 1: Barcode */}
              {activeTab === "barcode" && (
                <div className="space-y-4">
                  <form onSubmit={handleBarcodeSubmit} className="space-y-3">
                    <label htmlFor={`barcode-${slotLabel}`} className="block text-xs font-semibold text-[#1B2A22]">
                      Enter Barcode Digits
                    </label>
                    <div className="flex gap-2">
                      <Input
                        id={`barcode-${slotLabel}`}
                        type="text"
                        placeholder="e.g. 5449000000996"
                        value={barcodeInput}
                        onChange={(e) => {
                          setBarcodeInput(e.target.value.replace(/\s+/g, ""));
                          if (barcodeError) setBarcodeError(null);
                        }}
                        className="flex-1 text-sm font-mono"
                      />
                      <Button type="submit" variant="default" className="bg-[#1E5B45]">
                        Confirm
                      </Button>
                    </div>
                    {barcodeError && (
                      <p className="text-xs text-red-600 flex items-center gap-1">
                        <AlertCircle className="h-3.5 w-3.5" />
                        {barcodeError}
                      </p>
                    )}
                  </form>

                  <div className="relative my-4 flex items-center justify-center">
                    <span className="h-px w-full bg-[#E4DEC3]" />
                    <span className="bg-white px-3 text-xs text-[#5E6B63]">OR</span>
                  </div>

                  <div>
                    {!isCameraActive ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleStartCamera}
                        className="w-full gap-2 border-[#1E5B45]/40 text-[#1E5B45] hover:bg-[#1E5B45]/10"
                      >
                        <Camera className="h-4 w-4" />
                        <span>Scan Barcode with Camera</span>
                      </Button>
                    ) : (
                      <div className="space-y-3">
                        <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
                          <video
                            ref={attachVideoRef}
                            autoPlay
                            playsInline
                            muted
                            className="h-full w-full object-cover"
                          />
                          <div className="absolute inset-0 border-2 border-emerald-400/50 pointer-events-none" />
                        </div>
                        {scannerError && (
                          <p className="text-xs text-red-600">{scannerError}</p>
                        )}
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={handleStopCamera}
                          className="w-full text-xs"
                        >
                          Stop Camera
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tab 2: Search */}
              {activeTab === "search" && (
                <div className="space-y-4">
                  <form onSubmit={handleSearchSubmit} className="flex gap-2">
                    <Input
                      type="text"
                      placeholder="Search product (e.g. crackers, granola)"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="flex-1 text-sm"
                    />
                    <Button type="submit" disabled={searchLoading} className="bg-[#1E5B45]">
                      <Search className="h-4 w-4" />
                    </Button>
                  </form>

                  {searchError && (
                    <p className="text-xs text-amber-800 bg-amber-50 p-2.5 rounded-md border border-amber-200">
                      {searchError}
                    </p>
                  )}

                  {searchLoading && (
                    <p className="text-xs text-[#5E6B63] text-center py-4">
                      Searching Open Food Facts...
                    </p>
                  )}

                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {searchResults.map((item) => (
                      <div
                        key={item.ref}
                        onClick={() => {
                          onSelect(item.ref);
                          setIsOpen(false);
                        }}
                        className="flex items-center justify-between p-2.5 rounded-lg border border-[#E4DEC3] hover:bg-[#FBF8F2] cursor-pointer transition-colors"
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <p className="text-sm font-semibold text-[#1B2A22] truncate">
                            {item.name || "Unnamed Product"}
                          </p>
                          <p className="text-xs text-[#5E6B63] truncate">
                            {item.brand || "Brand not specified"}
                          </p>
                        </div>
                        <Button size="sm" variant="ghost" className="text-xs text-[#1E5B45] shrink-0">
                          Select
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tab 3: Session Labels */}
              {activeTab === "label" && (
                <div className="space-y-3">
                  <p className="text-xs text-[#5E6B63]">
                    Reviewed label products from this browser session:
                  </p>
                  {labelProducts.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-[#E4DEC3] p-6 text-center text-xs text-[#5E6B63]">
                      No reviewed label products found in this session.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {labelProducts.map((p) => (
                        <div
                          key={p.ref}
                          onClick={() => {
                            onSelect(p.ref);
                            setIsOpen(false);
                          }}
                          className="flex items-center justify-between p-2.5 rounded-lg border border-[#E4DEC3] hover:bg-sky-50/50 cursor-pointer transition-colors"
                        >
                          <div className="min-w-0 flex-1 pr-2">
                            <p className="text-sm font-semibold text-[#1B2A22] truncate">
                              {p.name || "Unnamed Label Product"}
                            </p>
                            <p className="text-xs text-sky-800">
                              From photo label · {p.nutrition.basis}
                            </p>
                          </div>
                          <Button size="sm" variant="ghost" className="text-xs text-sky-700 shrink-0">
                            Select
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
