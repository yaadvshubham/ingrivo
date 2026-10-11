import { createWorker, OEM } from "tesseract.js";

export class OcrTimeoutError extends Error {
  constructor(message = "OCR operation timed out after 60 seconds") {
    super(message);
    this.name = "OcrTimeoutError";
  }
}

export class OcrAbortError extends Error {
  constructor(message = "OCR operation was cancelled by the user") {
    super(message);
    this.name = "OcrAbortError";
  }
}

export class OcrWorkerError extends Error {
  constructor(message = "OCR recognition failed") {
    super(message);
    this.name = "OcrWorkerError";
  }
}

export interface OcrWord {
  text: string;
  confidence: number;
}

export interface OcrLine {
  text: string;
  words: OcrWord[];
}

export interface OcrResult {
  fullText: string;
  lines: OcrLine[];
  words: OcrWord[];
  wordConfidences: number[];
  meanConfidence: number;
}

export interface OcrOptions {
  onProgress?: (progress: number, statusText: string) => void;
  signal?: AbortSignal;
  timeoutMs?: number;
}

/**
 * Runs on-device OCR using self-hosted Tesseract.js assets.
 * Resolves full text, line structures, and per-word confidences.
 */
export async function runOcr(
  imageSource: HTMLCanvasElement | Blob | string,
  options: OcrOptions = {}
): Promise<OcrResult> {
  const { onProgress, signal, timeoutMs = 60000 } = options;

  if (signal?.aborted) {
    throw new OcrAbortError();
  }

  let worker: Awaited<ReturnType<typeof createWorker>> | null = null;
  let timerId: ReturnType<typeof setTimeout> | null = null;

  try {
    const workerPromise = createWorker(
      "eng",
      OEM.LSTM_ONLY,
      {
        workerPath: "/ocr/worker.min.js",
        corePath: "/ocr/core",
        langPath: "/ocr/lang-data",
        gzip: true,
        logger: (m) => {
          if (onProgress && typeof m.progress === "number") {
            const status = m.status || "recognizing text";
            onProgress(Math.min(1, Math.max(0, m.progress)), status);
          }
        },
      }
    );

    // Setup 60s timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      timerId = setTimeout(() => {
        reject(new OcrTimeoutError(`OCR processing timed out after ${timeoutMs / 1000} seconds`));
      }, timeoutMs);
    });

    // Abort signal listener
    const abortPromise = new Promise<never>((_, reject) => {
      if (signal) {
        signal.addEventListener("abort", () => {
          reject(new OcrAbortError());
        });
      }
    });

    worker = await Promise.race([workerPromise, timeoutPromise, abortPromise]);

    if (signal?.aborted) {
      throw new OcrAbortError();
    }

    const recognizePromise = worker.recognize(
      imageSource,
      {},
      {
        text: true,
        blocks: true,
      }
    );

    const result = await Promise.race([recognizePromise, timeoutPromise, abortPromise]);

    if (timerId) clearTimeout(timerId);

    const fullText = (result.data?.text || "").trim();
    const lines: OcrLine[] = [];
    const words: OcrWord[] = [];
    const wordConfidences: number[] = [];

    if (result.data?.blocks && Array.isArray(result.data.blocks)) {
      for (const block of result.data.blocks) {
        if (!block?.paragraphs) continue;
        for (const para of block.paragraphs) {
          if (!para?.lines) continue;
          for (const line of para.lines) {
            const lineWords: OcrWord[] = [];
            if (line.words && Array.isArray(line.words)) {
              for (const w of line.words) {
                const cleanWord = (w.text || "").trim();
                if (cleanWord) {
                  const conf = typeof w.confidence === "number" ? w.confidence : 0;
                  const wordObj: OcrWord = { text: cleanWord, confidence: conf };
                  lineWords.push(wordObj);
                  words.push(wordObj);
                  wordConfidences.push(conf);
                }
              }
            }
            const lineText = (line.text || lineWords.map((w) => w.text).join(" ")).trim();
            if (lineText) {
              lines.push({ text: lineText, words: lineWords });
            }
          }
        }
      }
    }

    // Fallback if blocks were not returned
    if (lines.length === 0 && fullText) {
      const rawLines = fullText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      for (const rl of rawLines) {
        const splitWords = rl.split(/\s+/).filter(Boolean);
        const lWords: OcrWord[] = splitWords.map((w) => {
          const conf = result.data?.confidence || 80;
          wordConfidences.push(conf);
          const wObj = { text: w, confidence: conf };
          words.push(wObj);
          return wObj;
        });
        lines.push({ text: rl, words: lWords });
      }
    }

    const meanConfidence =
      wordConfidences.length > 0
        ? wordConfidences.reduce((a, b) => a + b, 0) / wordConfidences.length
        : result.data?.confidence || 0;

    return {
      fullText,
      lines,
      words,
      wordConfidences,
      meanConfidence,
    };
  } catch (err: unknown) {
    if (timerId) clearTimeout(timerId);
    if (err instanceof OcrTimeoutError || err instanceof OcrAbortError) {
      throw err;
    }
    const message = err instanceof Error ? err.message : String(err);
    throw new OcrWorkerError(`OCR processing failed: ${message}`);
  } finally {
    if (worker) {
      try {
        await worker.terminate();
      } catch {
        // Ignore termination error
      }
    }
  }
}
