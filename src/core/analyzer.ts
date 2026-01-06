import type { Finding } from "../types/finding.js";
import type { AilintConfig } from "../types/config.js";
import { resolveLLMConfig } from "../types/config.js";
import type { AnalysisContext } from "../types/context.js";
import {
  initParser,
  parseCode,
  isParserInitialized,
} from "../parser/tree-sitter.js";
import { buildContext } from "../parser/context-builder.js";
import { buildSystemPrompt, buildUserPrompt } from "../llm/prompt-builder.js";
import { sendLLMRequest, LLMError } from "../llm/client.js";
import { parseResponse } from "../llm/response-parser.js";
import { logger } from "../utils/logger.js";

export interface AnalysisResult {
  findings: Finding[];
  error?: string;
  cached: boolean;
  metrics?: {
    parseTimeMs: number;
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
 * Main analysis function - parses code and sends to LLM for analysis.
 */
export async function analyze(
  options: AnalyzeOptions,
): Promise<AnalysisResult> {
  const startTime = Date.now();
  const { filePath, content, config, skipLLM = false } = options;

  // Ensure parser is initialized
  if (!isParserInitialized()) {
    await initParser();
  }

  // Check file size
  if (content.length > config.analysis.maxFileSize) {
    return {
      findings: [],
      error: `File exceeds size limit (${Math.round(content.length / 1024)}KB > ${Math.round(config.analysis.maxFileSize / 1024)}KB)`,
      cached: false,
    };
  }

  // Parse the code
  const parseStartTime = Date.now();
  const isTSX = filePath.endsWith(".tsx");

  let tree;
  try {
    tree = parseCode(content, isTSX);
  } catch (error) {
    logger.error("Parse error:", error);
    return {
      findings: [],
      error: "Failed to parse file",
      cached: false,
    };
  }

  const parseTimeMs = Date.now() - parseStartTime;

  // Build analysis context
  const context: AnalysisContext = buildContext(
    filePath,
    content,
    tree,
    config.analysis.mode,
  );

  logger.debug("Analysis context built", {
    imports: context.imports.length,
    declarations: context.declarations.length,
    metrics: context.metrics,
  });

  // Skip LLM if requested (for testing or when LLM is unavailable)
  if (skipLLM) {
    return {
      findings: generateLocalFindings(context, config),
      cached: false,
      metrics: {
        parseTimeMs,
        llmTimeMs: 0,
        totalTimeMs: Date.now() - startTime,
      },
    };
  }

  // Build prompts
  const systemPrompt = buildSystemPrompt(config.rules);
  const userPrompt = buildUserPrompt(context);

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
      requestId: filePath, // Use file path for queue deduplication
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
        parseTimeMs,
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
        // Don't show timeout as error - just use local analysis
        logger.debug("LLM request timed out, using local analysis");
        return {
          findings: generateLocalFindings(context, config),
          cached: false,
          metrics: {
            parseTimeMs,
            llmTimeMs,
            totalTimeMs: Date.now() - startTime,
          },
        };
      } else if (error.message === "Request superseded by newer request") {
        // Request was cancelled because user made changes - not an error
        logger.debug("Request cancelled (superseded)");
        return {
          findings: [],
          cached: false,
          metrics: {
            parseTimeMs,
            llmTimeMs,
            totalTimeMs: Date.now() - startTime,
          },
        };
      } else {
        errorMessage = error.message;
      }
    }

    logger.error("LLM error:", errorMessage);

    // Return local findings as fallback
    return {
      findings: generateLocalFindings(context, config),
      error: errorMessage,
      cached: false,
      metrics: {
        parseTimeMs,
        llmTimeMs,
        totalTimeMs: Date.now() - startTime,
      },
    };
  }
}

/**
 * Generate basic findings from local metrics (no LLM required).
 * Used as fallback when LLM is unavailable.
 */
function generateLocalFindings(
  context: AnalysisContext,
  config: AilintConfig,
): Finding[] {
  const findings: Finding[] = [];
  const { metrics } = context;

  // Check for long functions
  if (config.rules.codeSmells) {
    for (const fn of metrics.functions) {
      if (fn.lineCount > 50) {
        findings.push({
          id: "LOCAL001",
          title: "Long Function",
          severity: fn.lineCount > 100 ? "warning" : "info",
          message: `Function '${fn.name}' has ${fn.lineCount} lines. Consider breaking it into smaller functions.`,
          suggestion: "Extract related logic into separate helper functions.",
          category: "smell",
          confidence: 0.9,
          range: {
            startLine: fn.startLine,
            startCharacter: 0,
            endLine: fn.endLine,
            endCharacter: 0,
          },
        });
      }

      // Check for deep nesting
      if (fn.maxNestingDepth > 4) {
        findings.push({
          id: "LOCAL002",
          title: "Deep Nesting",
          severity: fn.maxNestingDepth > 6 ? "warning" : "info",
          message: `Function '${fn.name}' has nesting depth of ${fn.maxNestingDepth}. Deep nesting hurts readability.`,
          suggestion:
            "Use early returns, extract conditions into functions, or restructure control flow.",
          category: "smell",
          confidence: 0.85,
          range: {
            startLine: fn.startLine,
            startCharacter: 0,
            endLine: fn.endLine,
            endCharacter: 0,
          },
        });
      }
    }

    // Check for high file complexity
    if (metrics.estimatedComplexity > 20) {
      findings.push({
        id: "LOCAL003",
        title: "High File Complexity",
        severity: metrics.estimatedComplexity > 40 ? "warning" : "info",
        message: `File has estimated cyclomatic complexity of ${metrics.estimatedComplexity}. Consider splitting into multiple files.`,
        suggestion:
          "Break down into smaller modules with single responsibilities.",
        category: "smell",
        confidence: 0.7,
      });
    }
  }

  return findings;
}

export { initParser };
