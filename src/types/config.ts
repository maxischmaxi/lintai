import { z } from "zod";

// Supported LLM providers
export const LLMProviderSchema = z.enum([
  "openai",
  "anthropic",
  "gemini",
  "ollama",
  "openai-compatible", // For custom OpenAI-compatible endpoints
]);
export type LLMProvider = z.infer<typeof LLMProviderSchema>;

// Provider-specific default configurations
export const PROVIDER_DEFAULTS: Record<
  LLMProvider,
  { baseUrl: string; model: string; requiresKey: boolean }
> = {
  openai: {
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    requiresKey: true,
  },
  anthropic: {
    baseUrl: "https://api.anthropic.com",
    model: "claude-sonnet-4-20250514",
    requiresKey: true,
  },
  gemini: {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    model: "gemini-2.0-flash",
    requiresKey: true,
  },
  ollama: {
    baseUrl: "http://localhost:11434",
    model: "codellama",
    requiresKey: false,
  },
  "openai-compatible": {
    baseUrl: "http://localhost:8080/v1",
    model: "default",
    requiresKey: false,
  },
};

export const LLMConfigSchema = z.object({
  provider: LLMProviderSchema.default("openai"),
  baseUrl: z.string().optional(),
  model: z.string().optional(),
  apiKey: z.string().optional(),
  timeout: z.number().positive().default(30000),
  maxTokens: z.number().positive().default(2048),
});

export type LLMConfig = z.infer<typeof LLMConfigSchema>;

// Resolved LLM config with all defaults applied
export interface ResolvedLLMConfig {
  provider: LLMProvider;
  baseUrl: string;
  model: string;
  apiKey?: string;
  timeout: number;
  maxTokens: number;
}

export const AnalysisModeSchema = z.enum(["full-file", "snippet"]);
export type AnalysisMode = z.infer<typeof AnalysisModeSchema>;

export const AnalysisConfigSchema = z.object({
  mode: AnalysisModeSchema.default("snippet"),
  includeImports: z.boolean().default(false),
  maxFileSize: z.number().positive().default(100000),
});

export type AnalysisConfig = z.infer<typeof AnalysisConfigSchema>;

export const RulesConfigSchema = z.object({
  codeSmells: z.boolean().default(true),
  badPractices: z.boolean().default(true),
  spaghetti: z.boolean().default(true),
  naming: z.boolean().default(true),
  errorHandling: z.boolean().default(true),
  anyAbuse: z.boolean().default(true),
});

export type RulesConfig = z.infer<typeof RulesConfigSchema>;

export const SeverityConfigSchema = z.object({
  highConfidenceThreshold: z.number().min(0).max(1).default(0.8),
  mediumConfidenceThreshold: z.number().min(0).max(1).default(0.5),
});

export type SeverityConfig = z.infer<typeof SeverityConfigSchema>;

export const PerformanceConfigSchema = z.object({
  debounceMs: z.number().positive().default(600),
  maxConcurrent: z.number().positive().default(3),
  rateLimitPerMinute: z.number().positive().default(10),
  rateLimitEnabled: z.boolean().default(true),
});

export type PerformanceConfig = z.infer<typeof PerformanceConfigSchema>;

export const CLIConfigSchema = z.object({
  format: z.enum(["human", "json"]).default("human"),
  maxFiles: z.number().positive().default(100),
  extensions: z.array(z.string()).default(["ts", "tsx"]),
});

export type CLIConfig = z.infer<typeof CLIConfigSchema>;

export const AilintConfigSchema = z.object({
  llm: LLMConfigSchema.default({}),
  analysis: AnalysisConfigSchema.default({}),
  rules: RulesConfigSchema.default({}),
  severity: SeverityConfigSchema.default({}),
  performance: PerformanceConfigSchema.default({}),
  cli: CLIConfigSchema.default({}),
  debug: z.boolean().default(false),
});

export type AilintConfig = z.infer<typeof AilintConfigSchema>;

// Helper to resolve LLM config with provider-specific defaults
export function resolveLLMConfig(config: LLMConfig): ResolvedLLMConfig {
  const provider = config.provider ?? "openai";
  const defaults = PROVIDER_DEFAULTS[provider];

  return {
    provider,
    baseUrl: config.baseUrl ?? defaults.baseUrl,
    model: config.model ?? defaults.model,
    apiKey: config.apiKey,
    timeout: config.timeout ?? 30000,
    maxTokens: config.maxTokens ?? 2048,
  };
}
