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

/**
 * Extracts a valid barcode number from raw scanned text, QR code URLs,
 * GS1 digital links, or Open Food Facts web addresses.
 */
export function extractBarcodeFromText(input: string): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  // 1. Direct valid barcode string (EAN-8, UPC-A, EAN-13)
  if (isValidBarcode(trimmed)) {
    return trimmed;
  }

  // 2. Open Food Facts product URL: /product/(\d{8,14})
  const offMatch = trimmed.match(/\/product\/(?:bc-)?(\d{8,14})/i);
  if (offMatch) {
    const raw = offMatch[1];
    if (isValidBarcode(raw)) return raw;
    if (raw.length === 14 && raw.startsWith("0")) {
      const ean13 = raw.slice(1);
      if (isValidBarcode(ean13)) return ean13;
    }
  }

  // 3. GS1 Digital Link standard: /01/(\d{8,14})
  const gs1Match = trimmed.match(/\/01\/(\d{8,14})/);
  if (gs1Match) {
    const raw = gs1Match[1];
    if (isValidBarcode(raw)) return raw;
    if (raw.length === 14 && raw.startsWith("0")) {
      const ean13 = raw.slice(1);
      if (isValidBarcode(ean13)) return ean13;
    }
  }

  // 4. URL query parameters (e.g. ?barcode=... or ?gtin=... or ?code=...)
  const queryMatch = trimmed.match(/[?&](?:barcode|gtin|code|bc)=([0-9]{8,14})/i);
  if (queryMatch) {
    const raw = queryMatch[1];
    if (isValidBarcode(raw)) return raw;
    if (raw.length === 14 && raw.startsWith("0")) {
      const ean13 = raw.slice(1);
      if (isValidBarcode(ean13)) return ean13;
    }
  }

  // 5. Look for any standalone numeric token that passes check-digit validation
  const tokens = trimmed.match(/\b\d{8,14}\b/g);
  if (tokens) {
    for (const token of tokens) {
      if (isValidBarcode(token)) return token;
      if (token.length === 14 && token.startsWith("0")) {
        const ean13 = token.slice(1);
        if (isValidBarcode(ean13)) return ean13;
      }
    }
  }

  return null;
}

