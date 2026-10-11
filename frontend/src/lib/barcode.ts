/**
 * Barcode utilities for validating and normalizing barcodes (EAN-13, EAN-8, UPC-A).
 * Check digit validation matches GS1 / Open Food Facts standards.
 * Strings are preserved to keep leading zeros intact.
 */

export function isValidBarcode(barcode: string): boolean {
  if (typeof barcode !== "string") {
    return false;
  }

  const code = barcode.trim();
  if (!/^\d{8}$|^\d{12}$|^\d{13}$/.test(code)) {
    return false;
  }

  const checkDigit = parseInt(code[code.length - 1], 10);
  const payload = code.slice(0, -1);

  let total = 0;
  let weight = 3;

  for (let i = payload.length - 1; i >= 0; i--) {
    total += parseInt(payload[i], 10) * weight;
    weight = weight === 3 ? 1 : 3;
  }

  const calculatedCheckDigit = (10 - (total % 10)) % 10;
  return checkDigit === calculatedCheckDigit;
}

export function normalizeBarcode(barcode: string): string {
  const code = barcode.trim();
  if (code.length === 12) {
    return "0" + code;
  }
  return code;
}
