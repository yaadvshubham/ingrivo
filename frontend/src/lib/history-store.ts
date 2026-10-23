import { z } from "zod";
import { Product, ProductSchema } from "@/lib/schemas/product";
import { ExplainResponse, ExplainResponseSchema } from "@/lib/schemas/analysis";

export const HISTORY_STORAGE_KEY = "ingrivo.history.v1";
export const HISTORY_CHANGE_EVENT = "ingrivo-history-change";
export const MAX_HISTORY_ITEMS = 50;

export const HistoryItemSchema = z.object({
  ref: z.string(),
  kind: z.enum(["barcode", "label"]),
  title: z.string().nullable(),
  brand: z.string().nullable(),
  savedAt: z.string(),
  lastViewedAt: z.string(),
  snapshot: ProductSchema,
  explanation: ExplainResponseSchema.nullable().optional(),
});

export type HistoryItem = z.infer<typeof HistoryItemSchema>;

export const HistoryStoreSchema = z.object({
  version: z.literal(1),
  items: z.array(HistoryItemSchema),
});

export type HistoryStore = z.infer<typeof HistoryStoreSchema>;

// In-memory fallback if localStorage is disabled or throws QuotaExceededError
let memoryStore: HistoryStore = { version: 1, items: [] };
let storageDisabledNotice = false;

/**
 * Checks if browser localStorage is supported and accessible.
 */
export function isStorageAvailable(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const testKey = "__ingrivo_storage_test__";
    window.localStorage.setItem(testKey, testKey);
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns whether localStorage access is disabled/degraded (e.g. private mode or quota block).
 */
export function isStorageDegraded(): boolean {
  return storageDisabledNotice || !isStorageAvailable();
}

function sanitizeSnapshot(product: Product): Product {
  // Strip any large data URLs or blob URLs to avoid filling localStorage
  const isBinaryOrBlob =
    typeof product.image_url === "string" &&
    (product.image_url.startsWith("data:") || product.image_url.startsWith("blob:"));

  return {
    ...product,
    image_url: isBinaryOrBlob ? null : product.image_url,
    image_provenance: isBinaryOrBlob ? "missing" : product.image_provenance,
  };
}

function notifyChange(): void {
  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(new CustomEvent(HISTORY_CHANGE_EVENT));
    } catch {
      // Ignore in non-browser envs
    }
  }
}

const EMPTY_ITEMS: HistoryItem[] = [];
const EMPTY_STORE: HistoryStore = { version: 1, items: EMPTY_ITEMS };

let cachedRaw: string | null = null;
let cachedStore: HistoryStore | null = null;
let cachedSortedItems: HistoryItem[] | null = null;

function resetMemoryCache(): void {
  cachedRaw = null;
  cachedStore = null;
  cachedSortedItems = null;
}

/**
 * Safely reads raw store from localStorage with Zod validation.
 * If data is corrupt or version-mismatched, resets gracefully without crashing.
 */
function readStore(): HistoryStore {
  if (typeof window === "undefined") {
    return memoryStore;
  }

  if (!isStorageAvailable()) {
    storageDisabledNotice = true;
    return memoryStore;
  }

  try {
    const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) {
      cachedRaw = null;
      cachedStore = EMPTY_STORE;
      cachedSortedItems = EMPTY_ITEMS;
      return EMPTY_STORE;
    }

    if (raw === cachedRaw && cachedStore) {
      return cachedStore;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.warn("Corrupt JSON in scan history; resetting gracefully.");
      const fresh: HistoryStore = { version: 1, items: [] };
      writeStore(fresh);
      return fresh;
    }

    const validated = HistoryStoreSchema.safeParse(parsed);
    if (!validated.success) {
      console.warn(
        "History schema or version mismatch; resetting gracefully to v1.",
        validated.error.issues
      );
      const fresh: HistoryStore = { version: 1, items: [] };
      writeStore(fresh);
      return fresh;
    }

    cachedRaw = raw;
    cachedStore = validated.data;
    cachedSortedItems = null;
    return validated.data;
  } catch (err) {
    console.warn("Error reading localStorage; using in-memory store fallback:", err);
    storageDisabledNotice = true;
    return memoryStore;
  }
}

/**
 * Safely writes store to localStorage with quota protection and in-memory fallback.
 */
function writeStore(store: HistoryStore): boolean {
  memoryStore = store;
  resetMemoryCache();

  if (typeof window === "undefined" || !isStorageAvailable()) {
    storageDisabledNotice = true;
    notifyChange();
    return false;
  }

  try {
    window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(store));
    storageDisabledNotice = false;
    notifyChange();
    return true;
  } catch (err: unknown) {
    const isQuotaError =
      err instanceof Error &&
      (err.name === "QuotaExceededError" ||
        err.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
        err.message.toLowerCase().includes("quota"));

    if (isQuotaError) {
      console.warn("localStorage quota exceeded while saving history; evicting older items.");
      storageDisabledNotice = true;
      // Try evicting oldest 5 items and retry once
      if (store.items.length > 5) {
        const sorted = [...store.items].sort(
          (a, b) => new Date(b.lastViewedAt).getTime() - new Date(a.lastViewedAt).getTime()
        );
        const trimmed: HistoryStore = {
          version: 1,
          items: sorted.slice(0, Math.max(1, sorted.length - 5)),
        };
        try {
          window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(trimmed));
          memoryStore = trimmed;
          notifyChange();
          return true;
        } catch {
          // If still fails, fall back to memory
        }
      }
    } else {
      console.warn("Storage write failed (e.g. storage disabled); degrading to memory:", err);
      storageDisabledNotice = true;
    }
    notifyChange();
    return false;
  }
}

/**
 * Gets all history items sorted by lastViewedAt descending (most recent first).
 */
export function getHistory(): HistoryItem[] {
  const store = readStore();
  if (store.items.length === 0) {
    return EMPTY_ITEMS;
  }
  if (cachedSortedItems && cachedStore === store) {
    return cachedSortedItems;
  }
  cachedSortedItems = [...store.items].sort(
    (a, b) => new Date(b.lastViewedAt).getTime() - new Date(a.lastViewedAt).getTime()
  );
  return cachedSortedItems;
}

/**
 * Retrieves a single history item by product ref.
 */
export function getHistoryItem(ref: string): HistoryItem | null {
  const store = readStore();
  return store.items.find((item) => item.ref === ref) || null;
}

/**
 * Saves or updates a product in history.
 * Deduplicates by ref, updates lastViewedAt, caps at 50 items (evicting oldest lastViewedAt).
 */
export function saveHistoryItem(input: {
  ref: string;
  kind: "barcode" | "label";
  title?: string | null;
  brand?: string | null;
  snapshot: Product;
  explanation?: ExplainResponse | null;
}): HistoryItem {
  const now = new Date().toISOString();
  const store = readStore();
  const cleanSnapshot = sanitizeSnapshot(input.snapshot);

  const existingIndex = store.items.findIndex((item) => item.ref === input.ref);

  let updatedItem: HistoryItem;

  if (existingIndex >= 0) {
    const existing = store.items[existingIndex];
    updatedItem = {
      ...existing,
      kind: input.kind,
      title: input.title !== undefined ? input.title : cleanSnapshot.name,
      brand: input.brand !== undefined ? input.brand : cleanSnapshot.brand,
      lastViewedAt: now,
      snapshot: cleanSnapshot,
      explanation:
        input.explanation !== undefined ? input.explanation : existing.explanation,
    };
    store.items[existingIndex] = updatedItem;
  } else {
    updatedItem = {
      ref: input.ref,
      kind: input.kind,
      title: input.title !== undefined ? input.title : cleanSnapshot.name,
      brand: input.brand !== undefined ? input.brand : cleanSnapshot.brand,
      savedAt: now,
      lastViewedAt: now,
      snapshot: cleanSnapshot,
      explanation: input.explanation || null,
    };
    store.items.push(updatedItem);
  }

  // Sort by lastViewedAt desc and cap at MAX_HISTORY_ITEMS (50)
  store.items.sort(
    (a, b) => new Date(b.lastViewedAt).getTime() - new Date(a.lastViewedAt).getTime()
  );

  if (store.items.length > MAX_HISTORY_ITEMS) {
    store.items = store.items.slice(0, MAX_HISTORY_ITEMS);
  }

  writeStore(store);
  return updatedItem;
}

/**
 * Updates or persists an AI explanation for an existing history item.
 */
export function updateHistoryExplanation(
  ref: string,
  explanation: ExplainResponse
): void {
  const store = readStore();
  const item = store.items.find((i) => i.ref === ref);
  if (item) {
    item.explanation = explanation;
    writeStore(store);
  }
}

/**
 * Removes an individual item from history and returns it (enabling undo).
 */
export function removeHistoryItem(ref: string): HistoryItem | null {
  const store = readStore();
  const index = store.items.findIndex((i) => i.ref === ref);
  if (index === -1) return null;

  const [removed] = store.items.splice(index, 1);
  writeStore(store);
  return removed;
}

/**
 * Restores a previously removed item (undo action).
 */
export function restoreHistoryItem(item: HistoryItem): void {
  const store = readStore();
  const existingIndex = store.items.findIndex((i) => i.ref === item.ref);
  if (existingIndex >= 0) {
    store.items[existingIndex] = item;
  } else {
    store.items.push(item);
  }

  store.items.sort(
    (a, b) => new Date(b.lastViewedAt).getTime() - new Date(a.lastViewedAt).getTime()
  );
  if (store.items.length > MAX_HISTORY_ITEMS) {
    store.items = store.items.slice(0, MAX_HISTORY_ITEMS);
  }

  writeStore(store);
}

/**
 * Clears all history.
 */
export function clearHistory(): void {
  writeStore({ version: 1, items: [] });
}

/**
 * Subscribes to history updates across tabs (via window storage event)
 * and within the same tab (via custom event).
 */
export function subscribeToHistory(callback: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key === HISTORY_STORAGE_KEY || event.key === null) {
      resetMemoryCache();
      callback();
    }
  };

  const handleCustom = () => {
    callback();
  };

  window.addEventListener("storage", handleStorage);
  window.addEventListener(HISTORY_CHANGE_EVENT, handleCustom);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(HISTORY_CHANGE_EVENT, handleCustom);
  };
}
