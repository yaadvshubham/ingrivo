import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const frontendDir = path.resolve(__dirname, "..");
const wasmSrcPath = path.resolve(
  frontendDir,
  "node_modules",
  "zxing-wasm",
  "dist",
  "reader",
  "zxing_reader.wasm"
);
const wasmDestDir = path.resolve(frontendDir, "public", "wasm");
const wasmDestPath = path.resolve(wasmDestDir, "zxing_reader.wasm");

if (!fs.existsSync(wasmSrcPath)) {
  console.error(`[copy-wasm] Source WASM not found at ${wasmSrcPath}`);
  process.exit(1);
}

if (!fs.existsSync(wasmDestDir)) {
  fs.mkdirSync(wasmDestDir, { recursive: true });
}

fs.copyFileSync(wasmSrcPath, wasmDestPath);
console.log(`[copy-wasm] Successfully copied zxing_reader.wasm to ${wasmDestPath}`);
