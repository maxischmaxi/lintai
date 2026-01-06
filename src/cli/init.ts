import { writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { PROVIDER_DEFAULTS } from "../types/config.js";

// Config template with comments explaining each provider
const CONFIG_TEMPLATE = {
  $schema: "https://lintai.dev/schema.json",
  llm: {
    // Provider options: "openai", "anthropic", "gemini", "ollama", "openai-compatible"
    provider: "openai",
    // API key - can also be set via environment variable
    // OpenAI: OPENAI_API_KEY or LINTAI_API_KEY
    // Anthropic: ANTHROPIC_API_KEY or LINTAI_API_KEY
    // Gemini: GEMINI_API_KEY, GOOGLE_API_KEY, or LINTAI_API_KEY
    // Ollama: not required
    // apiKey: "your-api-key-here",
    // Model to use (provider-specific defaults apply if not set)
    // model: "gpt-4o-mini",
    // Request timeout in milliseconds
    timeout: 30000,
    // Maximum tokens in response
    maxTokens: 2048,
  },
  analysis: {
    // "snippet" sends only relevant code sections, "full-file" sends entire file
    mode: "snippet",
    // Whether to include imported file contents
    includeImports: false,
    // Maximum file size to analyze (bytes)
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
    // Confidence threshold for "error" severity
    highConfidenceThreshold: 0.8,
    // Confidence threshold for "warning" severity
    mediumConfidenceThreshold: 0.5,
  },
  performance: {
    // Debounce time for LSP mode (ms)
    debounceMs: 600,
    // Maximum API requests per minute
    rateLimitPerMinute: 10,
  },
  debug: false,
};

export function initConfig(cwd: string): {
  success: boolean;
  path: string;
  message: string;
} {
  // Check for existing config file
  const configPath = join(cwd, "lintai.json");
  if (existsSync(configPath)) {
    return {
      success: false,
      path: configPath,
      message: `Config file already exists: ${configPath}`,
    };
  }

  try {
    const content = JSON.stringify(CONFIG_TEMPLATE, null, 2);
    writeFileSync(configPath, content + "\n", "utf-8");

    const providerInfo = Object.entries(PROVIDER_DEFAULTS)
      .map(([provider, defaults]) => {
        const keyInfo = defaults.requiresKey
          ? "API key required"
          : "No API key needed";
        return `  - ${provider}: ${defaults.model} (${keyInfo})`;
      })
      .join("\n");

    return {
      success: true,
      path: configPath,
      message: `Created config file: ${configPath}

Available providers:
${providerInfo}

To use, set your API key:
  export OPENAI_API_KEY=sk-...      # For OpenAI
  export ANTHROPIC_API_KEY=sk-...   # For Anthropic
  export GEMINI_API_KEY=...         # For Google Gemini

Or for local Ollama (no key needed):
  Set "provider": "ollama" in lintai.json`,
    };
  } catch (error) {
    return {
      success: false,
      path: configPath,
      message: `Failed to create config file: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}
