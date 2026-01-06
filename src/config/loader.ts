import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import {
  AilintConfigSchema,
  type AilintConfig,
  type LLMProvider,
  PROVIDER_DEFAULTS,
  resolveLLMConfig,
  type ResolvedLLMConfig,
} from "../types/config.js";
import {
  DEFAULT_CONFIG,
  CONFIG_FILE_NAMES,
  ENV_VAR_MAPPINGS,
} from "./defaults.js";
import { logger, computeHash } from "../utils/index.js";

interface CLIOptions {
  config?: string;
  debug?: boolean;
  format?: "human" | "json";
  model?: string;
  baseUrl?: string;
  provider?: LLMProvider;
}

function findConfigFile(startDir: string): string | null {
  let currentDir = startDir;
  const root = dirname(currentDir);

  // Also check the start directory itself
  for (const fileName of CONFIG_FILE_NAMES) {
    const configPath = join(startDir, fileName);
    if (existsSync(configPath)) {
      return configPath;
    }
  }

  while (currentDir !== root) {
    currentDir = dirname(currentDir);
    for (const fileName of CONFIG_FILE_NAMES) {
      const configPath = join(currentDir, fileName);
      if (existsSync(configPath)) {
        return configPath;
      }
    }
  }

  return null;
}

function loadConfigFile(configPath: string): Partial<AilintConfig> {
  try {
    const content = readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(content);
    logger.debug(`Loaded config from ${configPath}`);
    return parsed;
  } catch (error) {
    logger.warn(`Failed to load config file: ${configPath}`, error);
    return {};
  }
}

function getAPIKeyFromEnv(provider: LLMProvider): string | undefined {
  const envVars = ENV_VAR_MAPPINGS[provider] || ["AILINT_API_KEY"];

  for (const envVar of envVars) {
    const value = process.env[envVar];
    if (value) {
      logger.debug(`Found API key in ${envVar}`);
      return value;
    }
  }

  return undefined;
}

function loadEnvConfig(
  provider: LLMProvider = "openai",
): Partial<AilintConfig> {
  const env: Partial<AilintConfig> = {};

  // Get API key based on provider
  const apiKey = getAPIKeyFromEnv(provider);
  const baseUrl = process.env["LINTAI_BASE_URL"];
  const model = process.env["LINTAI_MODEL"];
  const envProvider = process.env["LINTAI_PROVIDER"] as LLMProvider | undefined;

  if (apiKey || baseUrl || model || envProvider) {
    // Build partial llm config from env vars
    // This will be deep-merged with defaults, so we use type assertion
    const llmOverrides: Record<string, unknown> = {};
    if (apiKey) llmOverrides.apiKey = apiKey;
    if (baseUrl) llmOverrides.baseUrl = baseUrl;
    if (model) llmOverrides.model = model;
    if (envProvider) llmOverrides.provider = envProvider;

    // Use 'as any' because this partial will be deep-merged with full defaults
    (env as Record<string, unknown>).llm = llmOverrides;
  }

  // Debug mode
  if (
    process.env["LINTAI_DEBUG"] === "true" ||
    process.env["LINTAI_DEBUG"] === "1"
  ) {
    env.debug = true;
  }

  return env;
}

function applyCLIOptions(
  config: AilintConfig,
  options: CLIOptions,
): AilintConfig {
  const result = { ...config };

  if (options.debug !== undefined) {
    result.debug = options.debug;
  }

  if (options.format) {
    result.cli = { ...result.cli, format: options.format };
  }

  if (options.model || options.baseUrl || options.provider) {
    result.llm = {
      ...result.llm,
      ...(options.model && { model: options.model }),
      ...(options.baseUrl && { baseUrl: options.baseUrl }),
      ...(options.provider && { provider: options.provider }),
    };
  }

  return result;
}

function deepMerge<T extends Record<string, unknown>>(
  target: T,
  source: Partial<T>,
): T {
  const result = { ...target };

  for (const key of Object.keys(source) as (keyof T)[]) {
    const sourceValue = source[key];
    const targetValue = target[key];

    if (
      sourceValue !== undefined &&
      typeof sourceValue === "object" &&
      sourceValue !== null &&
      !Array.isArray(sourceValue) &&
      typeof targetValue === "object" &&
      targetValue !== null &&
      !Array.isArray(targetValue)
    ) {
      result[key] = deepMerge(
        targetValue as Record<string, unknown>,
        sourceValue as Record<string, unknown>,
      ) as T[keyof T];
    } else if (sourceValue !== undefined) {
      result[key] = sourceValue as T[keyof T];
    }
  }

  return result;
}

export function loadConfig(
  cwd: string,
  options: CLIOptions = {},
): AilintConfig {
  // Start with defaults
  let config: AilintConfig = { ...DEFAULT_CONFIG };

  // Load from config file (if specified or found)
  const configPath = options.config || findConfigFile(cwd);
  if (configPath) {
    const fileConfig = loadConfigFile(configPath);
    config = deepMerge(config, fileConfig);
  }

  // Determine provider (from file config, CLI, or default)
  const provider = options.provider || config.llm.provider || "openai";

  // Apply environment variables (with provider-specific API key lookup)
  const envConfig = loadEnvConfig(provider);
  config = deepMerge(config, envConfig);

  // Apply CLI options (highest priority)
  config = applyCLIOptions(config, options);

  // Validate final config
  const validated = AilintConfigSchema.safeParse(config);
  if (!validated.success) {
    logger.warn("Config validation issues:", validated.error.issues);
    // Return config with defaults applied for invalid fields
    return AilintConfigSchema.parse(config);
  }

  return validated.data;
}

export function getConfigHash(config: AilintConfig): string {
  // Only hash config options that affect analysis results
  const resolved = resolveLLMConfig(config.llm);
  const relevantConfig = {
    llm: { model: resolved.model, provider: resolved.provider },
    analysis: config.analysis,
    rules: config.rules,
  };
  return computeHash(JSON.stringify(relevantConfig));
}

export function validateAPIKey(config: AilintConfig): {
  valid: boolean;
  message?: string;
  provider: LLMProvider;
} {
  const resolved = resolveLLMConfig(config.llm);
  const provider = resolved.provider;
  const requiresKey = PROVIDER_DEFAULTS[provider]?.requiresKey ?? true;

  if (!requiresKey) {
    // Provider doesn't require API key (e.g., Ollama)
    return { valid: true, provider };
  }

  if (!resolved.apiKey) {
    const envVars = ENV_VAR_MAPPINGS[provider] || ["AILINT_API_KEY"];
    const envVarList = envVars.join(" or ");

    return {
      valid: false,
      provider,
      message: `API key not configured for ${provider}. Set ${envVarList} environment variable, or add "apiKey" to lintai.json`,
    };
  }

  return { valid: true, provider };
}

// Export for use in other modules
export { resolveLLMConfig, type ResolvedLLMConfig };
