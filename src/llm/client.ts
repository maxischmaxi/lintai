import type { ResolvedLLMConfig, LLMProvider } from "../types/config.js";
import { logger } from "../utils/logger.js";
import { getGlobalRateLimiter } from "./rate-limiter.js";
import { getGlobalRequestQueue } from "./request-queue.js";

export interface LLMResponse {
  content: string;
  error?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface LLMRequestOptions {
  systemPrompt: string;
  userPrompt: string;
  config: ResolvedLLMConfig;
  rateLimitPerMinute?: number;
  rateLimitEnabled?: boolean;
  requestId?: string; // For queue deduplication (e.g., file path)
  signal?: AbortSignal; // For cancellation
}

// ============================================================================
// OpenAI / OpenAI-Compatible
// ============================================================================

interface OpenAIResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

async function requestOpenAI(options: LLMRequestOptions): Promise<LLMResponse> {
  const { systemPrompt, userPrompt, config } = options;
  const url = `${config.baseUrl}/chat/completions`;

  const body = {
    model: config.model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    max_tokens: config.maxTokens,
    temperature: 0.1,
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (config.apiKey) {
    headers["Authorization"] = `Bearer ${config.apiKey}`;
  }

  logger.debug(`Sending request to OpenAI at ${url}`);

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(config.timeout),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new LLMError(
      `OpenAI API error: ${response.status} ${response.statusText}`,
      response.status,
      errorText,
    );
  }

  const data = (await response.json()) as OpenAIResponse;

  return {
    content: data.choices?.[0]?.message?.content ?? "",
    usage: data.usage
      ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        }
      : undefined,
  };
}

// ============================================================================
// Anthropic (Claude)
// ============================================================================

interface AnthropicResponse {
  content?: Array<{
    type: string;
    text?: string;
  }>;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

async function requestAnthropic(
  options: LLMRequestOptions,
): Promise<LLMResponse> {
  const { systemPrompt, userPrompt, config } = options;
  const url = `${config.baseUrl}/v1/messages`;

  const body = {
    model: config.model,
    max_tokens: config.maxTokens,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "anthropic-version": "2023-06-01",
  };

  if (config.apiKey) {
    headers["x-api-key"] = config.apiKey;
  }

  logger.debug(`Sending request to Anthropic at ${url}`);

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(config.timeout),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new LLMError(
      `Anthropic API error: ${response.status} ${response.statusText}`,
      response.status,
      errorText,
    );
  }

  const data = (await response.json()) as AnthropicResponse;

  // Extract text from content blocks
  const content =
    data.content
      ?.filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("") ?? "";

  return {
    content,
    usage: data.usage
      ? {
          promptTokens: data.usage.input_tokens,
          completionTokens: data.usage.output_tokens,
          totalTokens: data.usage.input_tokens + data.usage.output_tokens,
        }
      : undefined,
  };
}

// ============================================================================
// Google Gemini
// ============================================================================

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
}

async function requestGemini(options: LLMRequestOptions): Promise<LLMResponse> {
  const { systemPrompt, userPrompt, config } = options;

  // Gemini uses a different URL structure
  const url = `${config.baseUrl}/models/${config.model}:generateContent?key=${config.apiKey}`;

  const body = {
    contents: [
      {
        parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: config.maxTokens,
    },
  };

  logger.debug(`Sending request to Gemini`);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(config.timeout),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new LLMError(
      `Gemini API error: ${response.status} ${response.statusText}`,
      response.status,
      errorText,
    );
  }

  const data = (await response.json()) as GeminiResponse;

  // Extract text from response
  const content =
    data.candidates?.[0]?.content?.parts?.map((part) => part.text).join("") ??
    "";

  return {
    content,
    usage: data.usageMetadata
      ? {
          promptTokens: data.usageMetadata.promptTokenCount ?? 0,
          completionTokens: data.usageMetadata.candidatesTokenCount ?? 0,
          totalTokens: data.usageMetadata.totalTokenCount ?? 0,
        }
      : undefined,
  };
}

// ============================================================================
// Ollama (Local)
// ============================================================================

interface OllamaResponse {
  response?: string;
  prompt_eval_count?: number;
  eval_count?: number;
}

async function requestOllama(options: LLMRequestOptions): Promise<LLMResponse> {
  const { systemPrompt, userPrompt, config } = options;
  const url = `${config.baseUrl}/api/generate`;

  const body = {
    model: config.model,
    prompt: userPrompt,
    system: systemPrompt,
    stream: false,
    options: {
      temperature: 0.1,
      num_predict: config.maxTokens,
    },
  };

  logger.debug(`Sending request to Ollama at ${url}`);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(config.timeout),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new LLMError(
      `Ollama API error: ${response.status} ${response.statusText}`,
      response.status,
      errorText,
    );
  }

  const data = (await response.json()) as OllamaResponse;

  return {
    content: data.response ?? "",
    usage: data.prompt_eval_count
      ? {
          promptTokens: data.prompt_eval_count,
          completionTokens: data.eval_count ?? 0,
          totalTokens: (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0),
        }
      : undefined,
  };
}

// ============================================================================
// Error Handling
// ============================================================================

export class LLMError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public responseBody?: string,
  ) {
    super(message);
    this.name = "LLMError";
  }

  isRateLimited(): boolean {
    return this.statusCode === 429;
  }

  isAuthError(): boolean {
    return this.statusCode === 401 || this.statusCode === 403;
  }

  isServerError(): boolean {
    return this.statusCode !== undefined && this.statusCode >= 500;
  }
}

// ============================================================================
// Main Request Handler
// ============================================================================

const PROVIDER_REQUEST_MAP: Record<
  LLMProvider,
  (options: LLMRequestOptions) => Promise<LLMResponse>
> = {
  openai: requestOpenAI,
  "openai-compatible": requestOpenAI,
  anthropic: requestAnthropic,
  gemini: requestGemini,
  ollama: requestOllama,
};

export async function sendLLMRequest(
  options: LLMRequestOptions,
): Promise<LLMResponse> {
  // Use request queue for sequential processing (important for local LLMs)
  const queue = getGlobalRequestQueue();
  const requestId = options.requestId || `req-${Date.now()}`;

  return queue.enqueue(
    requestId,
    () => executeLLMRequest(options),
    options.signal,
  );
}

async function executeLLMRequest(
  options: LLMRequestOptions,
): Promise<LLMResponse> {
  // Only apply rate limiting if enabled (default: true)
  if (options.rateLimitEnabled !== false) {
    const rateLimiter = getGlobalRateLimiter(options.rateLimitPerMinute ?? 10);
    await rateLimiter.acquire();
  }

  const maxRetries = 3;
  const maxRateLimitRetries = 5; // Max retries for rate limiting before giving up
  let rateLimitRetries = 0;

  const requestFn = PROVIDER_REQUEST_MAP[options.config.provider];
  if (!requestFn) {
    throw new Error(`Unknown LLM provider: ${options.config.provider}`);
  }

  let attempt = 0;
  while (true) {
    attempt++;
    try {
      logger.debug(
        `LLM request attempt ${attempt} to ${options.config.provider}`,
      );

      const response = await requestFn(options);

      logger.debug("LLM request successful", response.usage);
      return response;
    } catch (error) {
      if (error instanceof LLMError) {
        // Don't retry auth errors - throw immediately
        if (error.isAuthError()) {
          throw error;
        }

        // Rate limited by provider - retry with exponential backoff
        if (error.isRateLimited()) {
          rateLimitRetries++;
          if (rateLimitRetries > maxRateLimitRetries) {
            // Give up after max retries, but don't show error to user
            // Just return empty response so local analysis runs
            logger.debug(
              `Rate limit retries exhausted, falling back to local analysis`,
            );
            return { content: "[]" };
          }
          // Cap wait time at 30 seconds
          const waitTime = Math.min(
            Math.pow(2, rateLimitRetries) * 1000,
            30000,
          );
          logger.debug(
            `Rate limited by provider, waiting ${waitTime}ms before retry (${rateLimitRetries}/${maxRateLimitRetries})`,
          );
          await sleep(waitTime);
          continue;
        }

        // Server errors - retry with backoff up to maxRetries
        if (error.isServerError() && attempt < maxRetries) {
          const waitTime = 1000 * attempt;
          logger.debug(`Server error, retrying in ${waitTime}ms`);
          await sleep(waitTime);
          continue;
        }
      }

      // Timeout - retry up to maxRetries
      if (
        error instanceof Error &&
        error.name === "TimeoutError" &&
        attempt < maxRetries
      ) {
        logger.debug("Request timed out, retrying...");
        continue;
      }

      throw error;
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
