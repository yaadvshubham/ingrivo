import { Product, ProductSchema } from "@/lib/schemas/product";

const STORAGE_PREFIX = "ingrivo_label_product_";

/**
 * Saves a parsed & reviewed label product to sessionStorage (text-only).
 * Never uses localStorage or IndexedDB.
 */
export function saveLabelProduct(product: Product): void {
  if (typeof window === "undefined" || !window.sessionStorage) return;
  try {
    const key = `${STORAGE_PREFIX}${product.ref}`;
    // Strip any binary or image URLs
    const sanitizedProduct: Product = {
      ...product,
      image_url: null,
      image_provenance: "missing",
    };
    window.sessionStorage.setItem(key, JSON.stringify(sanitizedProduct));
  } catch (err) {
    console.warn("Failed to save label product to sessionStorage:", err);
  }
}

/**
 * Retrieves a label product from sessionStorage by ref.
 * Returns null if not found or expired.
 */
export function getLabelProduct(ref: string): Product | null {
  if (typeof window === "undefined" || !window.sessionStorage) return null;
  try {
    const key = `${STORAGE_PREFIX}${ref}`;
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const validated = ProductSchema.safeParse(parsed);
    return validated.success ? validated.data : null;
  } catch (err) {
    console.warn("Failed to retrieve label product from sessionStorage:", err);
    return null;
  }
}

/**
 * Removes a label product from sessionStorage.
 */
export function clearLabelProduct(ref: string): void {
  if (typeof window === "undefined" || !window.sessionStorage) return;
  try {
    window.sessionStorage.removeItem(`${STORAGE_PREFIX}${ref}`);
  } catch (err) {
    console.warn("Failed to clear label product from sessionStorage:", err);
  }
}

/**
 * Lists all reviewed label products saved in this session.
 */
export function listAllLabelProducts(): Product[] {
  if (typeof window === "undefined" || !window.sessionStorage) return [];
  const results: Product[] = [];
  try {
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const key = window.sessionStorage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX)) {
        const raw = window.sessionStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          const validated = ProductSchema.safeParse(parsed);
          if (validated.success) {
            results.push(validated.data);
          }
        }
      }
    }
  } catch (err) {
    console.warn("Failed to list label products from sessionStorage:", err);
  }
  return results;
}
