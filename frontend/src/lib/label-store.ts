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
