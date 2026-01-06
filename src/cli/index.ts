import { readFileSync, statSync, existsSync } from "node:fs";
import { resolve, extname } from "node:path";
import { glob } from "glob";
import { loadConfig, validateAPIKey } from "../config/loader.js";
import { analyze, initParser, type AnalysisResult } from "../core/analyzer.js";
import { logger } from "../utils/logger.js";
import { formatResults, formatSummary, formatJSON } from "./formatter.js";
import { initConfig } from "./init.js";
import type { LLMProvider } from "../types/config.js";

export interface CLIArgs {
  paths: string[];
  lsp: boolean;
  init: boolean;
  json: boolean;
  debug: boolean;
  config?: string;
  ext?: string;
  maxFiles?: number;
  model?: string;
  baseUrl?: string;
  provider?: LLMProvider;
}

export async function runCLI(args: CLIArgs): Promise<number> {
  const cwd = process.cwd();

  // Handle --init
  if (args.init) {
    const result = initConfig(cwd);
    console.log(result.message);
    return result.success ? 0 : 2;
  }

  // Load config
  const config = loadConfig(cwd, {
    config: args.config,
    debug: args.debug,
    format: args.json ? "json" : "human",
    model: args.model,
    baseUrl: args.baseUrl,
    provider: args.provider,
  });

  // Set up logging
  if (config.debug) {
    logger.setLevel("debug");
  }

  logger.debug("Loaded config:", config);

  // Validate API key
  const apiKeyValidation = validateAPIKey(config);
  if (!apiKeyValidation.valid) {
    console.error(`Error: ${apiKeyValidation.message}`);
    return 2;
  }

  // Initialize parser
  try {
    await initParser();
  } catch (error) {
    console.error("Failed to initialize parser:", error);
    return 2;
  }

  // Get files to analyze
  const files = await resolveFiles(
    args.paths,
    config.cli.extensions,
    config.cli.maxFiles,
  );

  if (files.length === 0) {
    console.error("No TypeScript files found to analyze");
    return 2;
  }

  logger.info(`Analyzing ${files.length} file(s)...`);

  // Analyze files
  const results = new Map<string, AnalysisResult>();

  for (const filePath of files) {
    try {
      const content = readFileSync(filePath, "utf-8");
      const result = await analyze({
        filePath,
        content,
        config,
      });
      results.set(filePath, result);

      // Print progress for non-JSON output
      if (!args.json) {
        console.log(
          formatResults(filePath, result, {
            useColor: true,
            showMetrics: config.debug,
          }),
        );
      }
    } catch (error) {
      logger.error(`Error analyzing ${filePath}:`, error);
      results.set(filePath, {
        findings: [],
        error: error instanceof Error ? error.message : "Unknown error",
        cached: false,
      });
    }
  }

  // Output results
  if (args.json) {
    console.log(formatJSON(results));
  } else {
    // Print summary
    const bySeverity: Record<string, number> = {};
    let totalFindings = 0;

    for (const result of results.values()) {
      totalFindings += result.findings.length;
      for (const finding of result.findings) {
        bySeverity[finding.severity] = (bySeverity[finding.severity] || 0) + 1;
      }
    }

    console.log(
      formatSummary(results.size, totalFindings, bySeverity, {
        useColor: true,
      }),
    );
  }

  // Determine exit code
  const hasErrors = Array.from(results.values()).some((r) =>
    r.findings.some((f) => f.severity === "error"),
  );
  const hasWarnings = Array.from(results.values()).some((r) =>
    r.findings.some((f) => f.severity === "warning"),
  );

  if (hasErrors) return 1;
  if (hasWarnings) return 1;
  return 0;
}

async function resolveFiles(
  paths: string[],
  extensions: string[],
  maxFiles: number,
): Promise<string[]> {
  const files: string[] = [];
  const extSet = new Set(
    extensions.map((e) => (e.startsWith(".") ? e : `.${e}`)),
  );

  for (const inputPath of paths) {
    const resolved = resolve(inputPath);

    if (!existsSync(resolved)) {
      logger.warn(`Path does not exist: ${inputPath}`);
      continue;
    }

    const stat = statSync(resolved);

    if (stat.isFile()) {
      const ext = extname(resolved);
      if (extSet.has(ext)) {
        files.push(resolved);
      }
    } else if (stat.isDirectory()) {
      // Glob for files in directory
      const pattern = `${resolved}/**/*.{${extensions.join(",")}}`;
      const matches = await glob(pattern, {
        ignore: ["**/node_modules/**", "**/dist/**", "**/.git/**"],
        absolute: true,
      });
      files.push(...matches);
    }

    if (files.length >= maxFiles) {
      logger.warn(`Reached max files limit (${maxFiles})`);
      break;
    }
  }

  return files.slice(0, maxFiles);
}

export { initConfig };
