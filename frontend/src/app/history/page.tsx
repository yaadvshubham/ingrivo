"use client";

import React, { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  History as HistoryIcon,
  Trash2,
  Undo2,
  Barcode,
  Camera,
  AlertTriangle,
  Clock,
  Sparkles,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  getHistory,
  removeHistoryItem,
  restoreHistoryItem,
  clearHistory,
  subscribeToHistory,
  HistoryItem,
  isStorageDegraded,
} from "@/lib/history-store";
import { usePageTitle } from "@/hooks/usePageTitle";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { ScrollReveal } from "@/components/ui/ScrollReveal";

const emptyHistory: HistoryItem[] = [];
const getTrue = () => true;
const getFalse = () => false;

function HistoryContent() {
  usePageTitle("Scan History");

  const history = useSyncExternalStore(
    subscribeToHistory,
    getHistory,
    () => emptyHistory
  );

  const isDegraded = useSyncExternalStore(
    subscribeToHistory,
    isStorageDegraded,
    getFalse
  );

  const isLoaded = useSyncExternalStore(
    subscribeToHistory,
    getTrue,
    getFalse
  );

  const [lastRemovedItem, setLastRemovedItem] = useState<HistoryItem | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const handleRemove = (ref: string) => {
    const removed = removeHistoryItem(ref);
    if (removed) {
      setLastRemovedItem(removed);
    }
  };

  const handleUndo = () => {
    if (lastRemovedItem) {
      restoreHistoryItem(lastRemovedItem);
      setLastRemovedItem(null);
    }
  };

  const handleClearAll = () => {
    clearHistory();
    setLastRemovedItem(null);
    setShowClearConfirm(false);
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6 space-y-8">
      {/* Page Header */}
      <ScrollReveal blur={10} yOffset={20}>
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#1E5B45]/20 bg-[#1E5B45]/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[#1E5B45]">
            <HistoryIcon className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Local Device Storage</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-[#1B2A22]">
                Scan &amp; Review History
              </h1>
              <p className="text-sm text-[#5E6B63] max-w-xl leading-relaxed mt-1">
                Your recent lookups and confirmed label photos, stored strictly in this browser.
              </p>
            </div>
            {history.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowClearConfirm(true)}
                className="self-start sm:self-auto text-xs text-red-700 border-red-200 hover:bg-red-50 hover:text-red-800 gap-1.5 h-9"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Clear all history</span>
              </Button>
            )}
          </div>
        </div>
      </ScrollReveal>

      {/* Storage Degraded Notice (e.g. private browsing mode) */}
      {isDegraded && (
        <div
          role="status"
          className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 flex items-center gap-2.5"
        >
          <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0" aria-hidden="true" />
          <span>
            Storage is currently in-memory only (browser local storage is disabled or private browsing is active). History will reset when this session closes.
          </span>
        </div>
      )}

      {/* Undo Banner */}
      {lastRemovedItem && (
        <div
          role="status"
          aria-live="polite"
          className="p-3.5 bg-[#1E5B45]/10 border border-[#1E5B45]/30 rounded-xl text-xs text-[#1E5B45] flex items-center justify-between gap-3 shadow-xs"
        >
          <div className="flex items-center gap-2 truncate">
            <span className="font-semibold">Removed:</span>
            <span className="truncate italic">
              {lastRemovedItem.title || lastRemovedItem.ref}
            </span>
          </div>
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={handleUndo}
            className="h-7 text-xs px-2.5 gap-1 shrink-0 bg-[#1E5B45] text-white hover:bg-[#164433]"
          >
            <Undo2 className="h-3 w-3" aria-hidden="true" />
            <span>Undo</span>
          </Button>
        </div>
      )}

      {/* Clear Confirmation Dialog */}
      {showClearConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="clear-dialog-title"
          aria-describedby="clear-dialog-desc"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs"
        >
          <div className="w-full max-w-md bg-white rounded-2xl border border-[#E4DEC3] p-6 shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-2.5 text-red-700">
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
              <h2 id="clear-dialog-title" className="text-lg font-bold text-[#1B2A22]">
                Clear All History?
              </h2>
            </div>
            <p id="clear-dialog-desc" className="text-xs text-[#5E6B63] leading-relaxed">
              This will permanently delete all {history.length} saved product records from this browser. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowClearConfirm(false)}
                className="text-xs h-9"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleClearAll}
                className="text-xs h-9 bg-red-600 hover:bg-red-700 text-white font-semibold"
              >
                Yes, clear everything
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* History List or Empty State */}
      {!isLoaded ? (
        <div className="py-12 text-center text-xs text-[#5E6B63]">
          Loading history...
        </div>
      ) : history.length === 0 ? (
        <ScrollReveal blur={10} yOffset={20}>
          <Card className="border border-dashed border-[#E4DEC3] bg-[#FBF8F2]/60 p-10 text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#EFECE4] text-[#5E6B63]">
              <HistoryIcon className="h-7 w-7 opacity-60" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <h2 className="text-base font-bold text-[#1B2A22]">No Scan History Yet</h2>
              <p className="text-xs text-[#5E6B63] max-w-sm mx-auto leading-relaxed">
                Products you look up via barcode or review from camera labels will appear here for fast reopening and comparison.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-3 pt-2">
              <Link
                href="/scan"
                className={buttonVariants({
                  variant: "default",
                  size: "sm",
                  className: "gap-1.5 text-xs h-9",
                })}
              >
                <Barcode className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Scan a Barcode</span>
              </Link>
              <Link
                href="/label"
                className={buttonVariants({
                  variant: "outline",
                  size: "sm",
                  className: "gap-1.5 text-xs h-9",
                })}
              >
                <Camera className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Capture Label Photo</span>
              </Link>
            </div>
          </Card>
        </ScrollReveal>
      ) : (
        <div className="space-y-3" role="feed" aria-label="Scan history entries">
          {history.map((item, idx) => {
            const isLabel = item.kind === "label";
            const formattedDate = new Date(item.lastViewedAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            });

            return (
              <ScrollReveal key={item.ref} delay={Math.min(idx * 40, 200)} blur={8} yOffset={16}>
                <Card
                  className="border border-[#E4DEC3] bg-white hover:border-[#1E5B45]/40 transition-colors shadow-xs smooth-lift"
                >
                  <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap text-[11px]">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold ${
                            isLabel
                              ? "bg-sky-50 text-sky-800 border border-sky-200"
                              : "bg-[#1E5B45]/10 text-[#1E5B45] border border-[#1E5B45]/20"
                          }`}
                        >
                          {isLabel ? (
                            <>
                              <Camera className="h-3 w-3" aria-hidden="true" />
                              <span>Photo Label</span>
                            </>
                          ) : (
                            <>
                              <Barcode className="h-3 w-3" aria-hidden="true" />
                              <span>Barcode</span>
                            </>
                          )}
                        </span>
                        {item.brand && (
                          <span className="font-semibold text-[#5E6B63] uppercase tracking-wider truncate">
                            {item.brand}
                          </span>
                        )}
                        <span className="text-[#5E6B63]/60">•</span>
                        <span className="text-[#5E6B63] inline-flex items-center gap-1">
                          <Clock className="h-3 w-3 text-[#5E6B63]/70" aria-hidden="true" />
                          <span>Viewed {formattedDate}</span>
                        </span>
                        {item.explanation && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.2 rounded">
                            <Sparkles className="h-2.5 w-2.5" aria-hidden="true" />
                            <span>AI explanation saved</span>
                          </span>
                        )}
                      </div>

                      <Link
                        href={`/product/${item.ref}`}
                        className="block text-base font-bold text-[#1B2A22] hover:text-[#1E5B45] transition-colors truncate focus:outline-none focus-visible:underline"
                      >
                        {item.title || "Unnamed Product"}
                      </Link>

                      <div className="text-xs text-[#5E6B63] truncate">
                        <code>{item.ref}</code>
                        {item.snapshot.nutrition.basis && (
                          <span className="ml-2 text-[11px] text-[#5E6B63]/80">
                            (Basis: {item.snapshot.nutrition.basis.replace("_", " ")})
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <Link
                        href={`/product/${item.ref}`}
                        className={buttonVariants({
                          variant: "outline",
                          size: "sm",
                          className: "h-9 text-xs font-semibold gap-1.5 text-[#1E5B45] border-[#1E5B45]/30 hover:bg-[#1E5B45]/10",
                        })}
                      >
                        <span>Open</span>
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </Link>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemove(item.ref)}
                        aria-label={`Remove ${item.title || item.ref} from history`}
                        className="h-9 w-9 p-0 text-[#5E6B63] hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </ScrollReveal>
            );
          })}
        </div>
      )}

      {/* Browser-Only Storage Notice */}
      <ScrollReveal blur={10} yOffset={20}>
        <div className="rounded-xl border border-[#E4DEC3] bg-[#EFECE4]/50 p-4 text-xs text-[#5E6B63] flex items-start gap-3">
          <ShieldCheck className="h-4 w-4 text-[#1E5B45] shrink-0 mt-0.5" aria-hidden="true" />
          <p className="leading-relaxed">
            <strong>Privacy note:</strong> History is stored and synced securely to your personal account in this browser.
          </p>
        </div>
      </ScrollReveal>
    </div>
  );
}

export default function HistoryPage() {
  return (
    <AuthGuard
      featureName="Scan History & Saved Products"
      description="Sign in to view and synchronize your recent product scans and saved favorites."
    >
      <HistoryContent />
    </AuthGuard>
  );
}
