import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const frontendDir = path.resolve(__dirname, "..");
const publicOcrDir = path.resolve(frontendDir, "public", "ocr");

// Source paths
const tesseractDistDir = path.resolve(frontendDir, "node_modules", "tesseract.js", "dist");
const tesseractCoreDir = path.resolve(frontendDir, "node_modules", "tesseract.js-core");
const tesseractDataDir = path.resolve(frontendDir, "node_modules", "@tesseract.js-data", "eng");

// Target paths
const destWorkerPath = path.resolve(publicOcrDir, "worker.min.js");
const destCoreDir = path.resolve(publicOcrDir, "core");
const destLangDir = path.resolve(publicOcrDir, "lang-data");

if (!fs.existsSync(tesseractDistDir) || !fs.existsSync(tesseractCoreDir)) {
  console.error("[copy-ocr-assets] Required tesseract modules not found in node_modules.");
  process.exit(1);
}

// Ensure destination directories exist
fs.mkdirSync(destCoreDir, { recursive: true });
fs.mkdirSync(destLangDir, { recursive: true });

let totalBytes = 0;

function copyFile(src, dest) {
  fs.copyFileSync(src, dest);
  const stat = fs.statSync(dest);
  totalBytes += stat.size;
}

// 1. Copy worker.min.js
const srcWorkerPath = path.resolve(tesseractDistDir, "worker.min.js");
if (fs.existsSync(srcWorkerPath)) {
  copyFile(srcWorkerPath, destWorkerPath);
  console.log(`[copy-ocr-assets] Copied worker.min.js`);
} else {
  console.error(`[copy-ocr-assets] worker.min.js not found at ${srcWorkerPath}`);
  process.exit(1);
}

// 2. Copy core files
// Core directory must contain the variants:
// tesseract-core.wasm.js, tesseract-core-simd.wasm.js, tesseract-core-lstm.wasm.js, tesseract-core-simd-lstm.wasm.js
// along with their .wasm files.
const coreFiles = fs.readdirSync(tesseractCoreDir).filter(f => f.startsWith("tesseract-core"));
for (const file of coreFiles) {
  const src = path.resolve(tesseractCoreDir, file);
  const dest = path.resolve(destCoreDir, file);
  copyFile(src, dest);
}
console.log(`[copy-ocr-assets] Copied ${coreFiles.length} core files to ${destCoreDir}`);

// 3. Copy traineddata
// Prefer 4.0.0_best_int/eng.traineddata.gz (standard for LSTM tesseract.js), fallback to 4.0.0
let trainedDataSrc = path.resolve(tesseractDataDir, "4.0.0_best_int", "eng.traineddata.gz");
if (!fs.existsSync(trainedDataSrc)) {
  trainedDataSrc = path.resolve(tesseractDataDir, "4.0.0", "eng.traineddata.gz");
}

if (fs.existsSync(trainedDataSrc)) {
  const destLangPath = path.resolve(destLangDir, "eng.traineddata.gz");
  copyFile(trainedDataSrc, destLangPath);
  console.log(`[copy-ocr-assets] Copied eng.traineddata.gz from ${trainedDataSrc}`);
} else {
  console.error(`[copy-ocr-assets] eng.traineddata.gz not found in ${tesseractDataDir}`);
  process.exit(1);
}

const totalMB = (totalBytes / (1024 * 1024)).toFixed(2);
console.log(`[copy-ocr-assets] All OCR assets self-hosted successfully. Total size: ${totalBytes} bytes (${totalMB} MB).`);
