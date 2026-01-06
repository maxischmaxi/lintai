import type { Finding } from "../types/finding.js";
import type { AilintConfig } from "../types/config.js";
import { resolveLLMConfig } from "../types/config.js";
import { buildSystemPrompt, buildUserPrompt } from "../llm/prompt-builder.js";
import { sendLLMRequest, LLMError } from "../llm/client.js";
import { parseResponse } from "../llm/response-parser.js";
import { logger } from "../utils/logger.js";
import { getLanguageForExtension } from "./languages.js";

export interface AnalysisResult {
  findings: Finding[];
  error?: string;
  cached: boolean;
  metrics?: {
    llmTimeMs: number;
    totalTimeMs: number;
  };
}

export interface AnalyzeOptions {
  filePath: string;
  content: string;
  config: AilintConfig;
  skipLLM?: boolean;
}

/**
 * Main analysis function - sends code directly to LLM for analysis.
 */
export async function analyze(
  options: AnalyzeOptions,
): Promise<AnalysisResult> {
  const startTime = Date.now();
  const { filePath, content, config, skipLLM = false } = options;

  // Check file size
  if (content.length > config.analysis.maxFileSize) {
    return {
      findings: [],
      error: `File exceeds size limit (${Math.round(content.length / 1024)}KB > ${Math.round(config.analysis.maxFileSize / 1024)}KB)`,
      cached: false,
    };
  }

  // Detect language from file extension
  const ext = filePath.slice(filePath.lastIndexOf("."));
  const language = getLanguageForExtension(ext);

  logger.debug("Analyzing file", {
    filePath,
    language: language?.id || "unknown",
    contentLength: content.length,
  });

  // Skip LLM if requested (for testing)
  if (skipLLM) {
    return {
      findings: [],
      cached: false,
      metrics: {
        llmTimeMs: 0,
        totalTimeMs: Date.now() - startTime,
      },
    };
  }

  // Build prompts
  const systemPrompt = buildSystemPrompt(config.rules, language?.id);
  const userPrompt = buildUserPrompt(filePath, content, language?.id);

  // Resolve LLM config with provider defaults
  const resolvedLLMConfig = resolveLLMConfig(config.llm);

  // Send to LLM
  const llmStartTime = Date.now();

  try {
    const response = await sendLLMRequest({
      systemPrompt,
      userPrompt,
      config: resolvedLLMConfig,
      rateLimitPerMinute: config.performance.rateLimitPerMinute,
      rateLimitEnabled: config.performance.rateLimitEnabled,
      requestId: filePath,
    });

    const llmTimeMs = Date.now() - llmStartTime;

    // Parse response
    const parseResult = parseResponse(response.content);

    if (parseResult.parseError) {
      logger.warn("Response parse issue:", parseResult.parseError);
    }

    return {
      findings: parseResult.findings,
      error: parseResult.parseError,
      cached: false,
      metrics: {
        llmTimeMs,
        totalTimeMs: Date.now() - startTime,
      },
    };
  } catch (error) {
    const llmTimeMs = Date.now() - llmStartTime;

    let errorMessage = "LLM request failed";

    if (error instanceof LLMError) {
      if (error.isAuthError()) {
        errorMessage = `Invalid API key for ${resolvedLLMConfig.provider}. Check your API key configuration.`;
      } else if (error.isServerError()) {
        errorMessage = "LLM service temporarily unavailable.";
      } else {
        errorMessage = error.message;
      }
    } else if (error instanceof Error) {
      if (error.name === "TimeoutError") {
        logger.debug("LLM request timed out");
        return {
          findings: [],
          error: "Analysis timed out",
          cached: false,
          metrics: {
            llmTimeMs,
            totalTimeMs: Date.now() - startTime,
          },
        };
      } else if (error.message === "Request superseded by newer request") {
        logger.debug("Request cancelled (superseded)");
        return {
          findings: [],
          cached: false,
          metrics: {
            llmTimeMs,
            totalTimeMs: Date.now() - startTime,
          },
        };
      } else {
        errorMessage = error.message;
      }
    }

    logger.error("LLM error:", errorMessage);

    return {
      findings: [],
      error: errorMessage,
      cached: false,
      metrics: {
        llmTimeMs,
        totalTimeMs: Date.now() - startTime,
      },
    };
  }
}
