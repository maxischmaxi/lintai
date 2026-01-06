import type { AilintConfig } from "../types/config.js";

export const DEFAULT_CONFIG: AilintConfig = {
  llm: {
    provider: "openai",
    // baseUrl and model will be resolved from PROVIDER_DEFAULTS
    timeout: 30000,
    maxTokens: 2048,
  },
  analysis: {
    mode: "snippet",
    includeImports: false,
    maxFileSize: 100000,
  },
  rules: {
    codeSmells: true,
    badPractices: true,
    spaghetti: true,
    naming: true,
    errorHandling: true,
    anyAbuse: true,
  },
  severity: {
    highConfidenceThreshold: 0.8,
    mediumConfidenceThreshold: 0.5,
  },
  performance: {
    debounceMs: 600,
    maxConcurrent: 3,
    rateLimitPerMinute: 10,
    rateLimitEnabled: true,
  },
  cli: {
    format: "human",
    maxFiles: 100,
    extensions: ["ts", "tsx", "js", "jsx", "go"],
  },
  debug: false,
};

// Config file name - only lintai.json is supported
export const CONFIG_FILE_NAMES = ["lintai.json"];

// Environment variable mappings per provider
export const ENV_VAR_MAPPINGS: Record<string, string[]> = {
  openai: ["LINTAI_API_KEY", "OPENAI_API_KEY"],
  anthropic: ["LINTAI_API_KEY", "ANTHROPIC_API_KEY"],
  gemini: ["LINTAI_API_KEY", "GEMINI_API_KEY", "GOOGLE_API_KEY"],
  ollama: [], // No key needed
  "openai-compatible": ["LINTAI_API_KEY"],
};
