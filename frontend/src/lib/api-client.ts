import { Product, ProductSchema } from "./schemas/product";
import { SearchResponse, SearchResponseSchema } from "./schemas/search";
import {
  ExplainResponse,
  ExplainResponseSchema,
  ExplainRequestSource,
} from "./schemas/analysis";
import {
  CompareRequest,
  CompareResponse,
  CompareResponseSchema,
} from "./schemas/compare";

export type { ExplainRequestSource };

export class ApiError extends Error {
  public code: string;
  public status: number;
  public fallbacks?: string[];

  constructor(message: string, code: string, status: number, fallbacks?: string[]) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.fallbacks = fallbacks;
  }
}

export interface GetProductOptions {
  timeoutMs?: number;
  onSlow?: () => void;
  slowThresholdMs?: number;
}

export async function getProduct(
  barcode: string,
  options: GetProductOptions = {}
): Promise<Product> {
  const { timeoutMs = 12000, onSlow, slowThresholdMs = 3500 } = options;
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
  const url = `${baseUrl}/api/v1/products/barcode/${barcode}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let slowTimer: ReturnType<typeof setTimeout> | null = null;
  if (onSlow) {
    slowTimer = setTimeout(() => {
      onSlow();
    }, slowThresholdMs);
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if (slowTimer) clearTimeout(slowTimer);

    if (err instanceof Error && err.name === "AbortError") {
      throw new ApiError(
        "Request timed out while waiting for server response.",
        "UPSTREAM_TIMEOUT",
        504
      );
    }
    throw new ApiError(
      err instanceof Error ? err.message : "Network error contacting server.",
      "NETWORK_ERROR",
      0
    );
  } finally {
    clearTimeout(timeoutId);
    if (slowTimer) clearTimeout(slowTimer);
  }

  if (!response.ok) {
    let errorCode = "UNKNOWN_ERROR";
    let errorMessage = "An unknown error occurred.";
    let fallbacks: string[] | undefined = undefined;

    try {
      const data = await response.json();
      if (data.error) {
        errorCode = data.error.code || errorCode;
        errorMessage = data.error.message || errorMessage;
        if (data.error.fallbacks) {
          fallbacks = data.error.fallbacks;
        } else if (typeof data.error.message === "string" && data.error.message.includes("fallbacks")) {
          try {
            const parsedMeta = JSON.parse(
              data.error.message.slice(data.error.message.indexOf("{"))
            );
            if (parsedMeta.fallbacks) fallbacks = parsedMeta.fallbacks;
          } catch {
            // Ignore if unparseable
          }
        }
      }
    } catch {
      // Ignored if not JSON
    }
    throw new ApiError(errorMessage, errorCode, response.status, fallbacks);
  }

  const rawData = await response.json();
  const parsed = ProductSchema.safeParse(rawData);

  if (!parsed.success) {
    console.error("Zod parse error:", parsed.error);
    throw new ApiError(
      "Failed to parse product schema from server",
      "SCHEMA_ERROR",
      500
    );
  }

  return parsed.data;
}

export interface SearchProductsOptions {
  timeoutMs?: number;
  onSlow?: () => void;
  slowThresholdMs?: number;
  signal?: AbortSignal;
}

export async function searchProducts(
  query: string,
  page: number = 1,
  options: SearchProductsOptions = {}
): Promise<SearchResponse> {
  const { timeoutMs = 12000, onSlow, slowThresholdMs = 3500, signal: externalSignal } = options;
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
  const url = `${baseUrl}/api/v1/products/search?q=${encodeURIComponent(query)}&page=${page}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener("abort", () => controller.abort(), { once: true });
    }
  }

  let slowTimer: ReturnType<typeof setTimeout> | null = null;
  if (onSlow) {
    slowTimer = setTimeout(() => {
      onSlow();
    }, slowThresholdMs);
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if (slowTimer) clearTimeout(slowTimer);

    if (err instanceof Error && err.name === "AbortError") {
      throw new ApiError(
        "Request timed out while waiting for server response.",
        "UPSTREAM_TIMEOUT",
        504
      );
    }
    throw new ApiError(
      err instanceof Error ? err.message : "Network error contacting server.",
      "NETWORK_ERROR",
      0
    );
  } finally {
    clearTimeout(timeoutId);
    if (slowTimer) clearTimeout(slowTimer);
  }

  if (!response.ok) {
    let errorCode = "UNKNOWN_ERROR";
    let errorMessage = "An unknown error occurred.";
    let fallbacks: string[] | undefined = undefined;

    try {
      const data = await response.json();
      if (data.error) {
        errorCode = data.error.code || errorCode;
        errorMessage = data.error.message || errorMessage;
        if (data.error.fallbacks) {
          fallbacks = data.error.fallbacks;
        }
      }
    } catch {
      // Ignored if not JSON
    }
    throw new ApiError(errorMessage, errorCode, response.status, fallbacks);
  }

  const rawData = await response.json();
  const parsed = SearchResponseSchema.safeParse(rawData);

  if (!parsed.success) {
    console.error("Zod parse error:", parsed.error);
    throw new ApiError(
      "Failed to parse search response from server",
      "SCHEMA_ERROR",
      500
    );
  }

  return parsed.data;
}

export interface ExplainProductOptions {
  timeoutMs?: number;
  onSlow?: () => void;
  slowThresholdMs?: number;
}

export async function explainProduct(
  source: ExplainRequestSource,
  options: ExplainProductOptions = {}
): Promise<ExplainResponse> {
  const { timeoutMs = 30000, onSlow, slowThresholdMs = 3500 } = options;
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
  const url = `${baseUrl}/api/v1/analysis/explain`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let slowTimer: ReturnType<typeof setTimeout> | null = null;
  if (onSlow) {
    slowTimer = setTimeout(() => {
      onSlow();
    }, slowThresholdMs);
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ source, language: "en" }),
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if (slowTimer) clearTimeout(slowTimer);

    if (err instanceof Error && err.name === "AbortError") {
      throw new ApiError(
        "Request timed out while waiting for AI explanation.",
        "AI_UNAVAILABLE",
        504
      );
    }
    throw new ApiError(
      "Network connection error while contacting server.",
      "NETWORK_ERROR",
      503
    );
  } finally {
    clearTimeout(timeoutId);
    if (slowTimer) clearTimeout(slowTimer);
  }

  if (!response.ok) {
    let errorCode = "UNKNOWN_ERROR";
    let errorMessage = "An unknown error occurred.";

    try {
      const data = await response.json();
      if (data.error) {
        errorCode = data.error.code || errorCode;
        errorMessage = data.error.message || errorMessage;
      }
    } catch {
      // Ignored
    }
    throw new ApiError(errorMessage, errorCode, response.status);
  }

  const rawData = await response.json();
  const parsed = ExplainResponseSchema.safeParse(rawData);

  if (!parsed.success) {
    console.error("Zod parse error for AI explanation:", parsed.error);
    throw new ApiError(
      "We couldn't produce a reliable explanation; the facts above are unaffected.",
      "AI_INVALID_OUTPUT",
      502
    );
  }

  return parsed.data;
}

export interface CompareProductsOptions {
  timeoutMs?: number;
  onSlow?: () => void;
  slowThresholdMs?: number;
  signal?: AbortSignal;
}

export async function compareProducts(
  request: CompareRequest,
  options: CompareProductsOptions = {}
): Promise<CompareResponse> {
  const { timeoutMs = 30000, onSlow, slowThresholdMs = 3500, signal: externalSignal } = options;
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
  const url = `${baseUrl}/api/v1/compare`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener("abort", () => controller.abort(), { once: true });
    }
  }

  let slowTimer: ReturnType<typeof setTimeout> | null = null;
  if (onSlow) {
    slowTimer = setTimeout(() => {
      onSlow();
    }, slowThresholdMs);
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        a: request.a,
        b: request.b,
        include_ai_explanation: Boolean(request.include_ai_explanation),
        language: "en",
      }),
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if (slowTimer) clearTimeout(slowTimer);

    if (err instanceof Error && err.name === "AbortError") {
      throw new ApiError(
        "Request timed out while waiting for product comparison.",
        "UPSTREAM_TIMEOUT",
        504
      );
    }
    throw new ApiError(
      "Network connection error while contacting server.",
      "NETWORK_ERROR",
      503
    );
  } finally {
    clearTimeout(timeoutId);
    if (slowTimer) clearTimeout(slowTimer);
  }

  if (!response.ok) {
    let errorCode = "UNKNOWN_ERROR";
    let errorMessage = "An unknown error occurred while comparing products.";

    try {
      const data = await response.json();
      if (data.error) {
        errorCode = data.error.code || errorCode;
        errorMessage = data.error.message || errorMessage;
      }
    } catch {
      // Ignored
    }
    throw new ApiError(errorMessage, errorCode, response.status);
  }

  const rawData = await response.json();
  const parsed = CompareResponseSchema.safeParse(rawData);

  if (!parsed.success) {
    console.error("Zod parse error for comparison:", parsed.error);
    throw new ApiError(
      "Failed to parse comparison response from server.",
      "SCHEMA_ERROR",
      502
    );
  }

  return parsed.data;
}

// ---------------------------------------------------------------------------
// Chat API
// ---------------------------------------------------------------------------

export type ChatLanguage = "hinglish" | "hindi" | "english";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResponse {
  reply: string;
  model: string;
}

export interface ChatProductOptions {
  timeoutMs?: number;
  onSlow?: () => void;
  slowThresholdMs?: number;
}

export async function chatWithProduct(
  source: ExplainRequestSource,
  messages: ChatMessage[],
  language: ChatLanguage = "hinglish",
  options: ChatProductOptions = {}
): Promise<ChatResponse> {
  const { timeoutMs = 30000, onSlow, slowThresholdMs = 3500 } = options;
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
  const url = `${baseUrl}/api/v1/analysis/chat`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let slowTimer: ReturnType<typeof setTimeout> | null = null;
  if (onSlow) {
    slowTimer = setTimeout(() => onSlow(), slowThresholdMs);
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source, messages, language }),
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if (slowTimer) clearTimeout(slowTimer);
    if (err instanceof Error && err.name === "AbortError") {
      throw new ApiError("Chat request timed out.", "AI_UNAVAILABLE", 504);
    }
    throw new ApiError("Network error contacting server.", "NETWORK_ERROR", 503);
  } finally {
    clearTimeout(timeoutId);
    if (slowTimer) clearTimeout(slowTimer);
  }

  if (!response.ok) {
    let errorCode = "UNKNOWN_ERROR";
    let errorMessage = "An unknown error occurred.";
    try {
      const data = await response.json();
      if (data.error) {
        errorCode = data.error.code || errorCode;
        errorMessage = data.error.message || errorMessage;
      }
    } catch {
      // Ignored
    }
    throw new ApiError(errorMessage, errorCode, response.status);
  }

  const rawData = await response.json();
  return rawData as ChatResponse;
}
