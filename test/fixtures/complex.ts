/**
 * Complex file with high cyclomatic complexity for testing metrics.
 */

export interface Config {
  mode: "development" | "production" | "test";
  features: {
    featureA: boolean;
    featureB: boolean;
    featureC: boolean;
  };
  limits: {
    maxRetries: number;
    timeout: number;
  };
}

export function processRequest(
  config: Config,
  input: unknown,
  options?: { verbose?: boolean; strict?: boolean },
): { success: boolean; result?: unknown; error?: string } {
  // High complexity due to multiple conditions
  if (!config) {
    return { success: false, error: "Config is required" };
  }

  if (!input) {
    return { success: false, error: "Input is required" };
  }

  const isVerbose = options?.verbose ?? false;
  const isStrict = options?.strict ?? false;

  // Mode-based processing
  if (config.mode === "development") {
    if (isVerbose) {
      console.log("Development mode with verbose logging");
    }
    if (config.features.featureA) {
      if (config.features.featureB) {
        return processWithBothFeatures(input);
      } else {
        return processWithFeatureA(input);
      }
    } else if (config.features.featureB) {
      return processWithFeatureB(input);
    }
  } else if (config.mode === "production") {
    if (isStrict) {
      if (!validateInput(input)) {
        return { success: false, error: "Validation failed in strict mode" };
      }
    }
    if (config.features.featureC) {
      return processWithFeatureC(input);
    }
  } else if (config.mode === "test") {
    return { success: true, result: "test-mode-result" };
  }

  // Fallback processing
  try {
    const processed = defaultProcess(input);
    if (processed === null) {
      return { success: false, error: "Processing returned null" };
    }
    if (processed === undefined) {
      return { success: false, error: "Processing returned undefined" };
    }
    return { success: true, result: processed };
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Unknown error" };
  }
}

function processWithBothFeatures(input: unknown): {
  success: boolean;
  result?: unknown;
} {
  return { success: true, result: { features: ["A", "B"], input } };
}

function processWithFeatureA(input: unknown): {
  success: boolean;
  result?: unknown;
} {
  return { success: true, result: { features: ["A"], input } };
}

function processWithFeatureB(input: unknown): {
  success: boolean;
  result?: unknown;
} {
  return { success: true, result: { features: ["B"], input } };
}

function processWithFeatureC(input: unknown): {
  success: boolean;
  result?: unknown;
} {
  return { success: true, result: { features: ["C"], input } };
}

function validateInput(input: unknown): boolean {
  return input !== null && input !== undefined;
}

function defaultProcess(input: unknown): unknown {
  return input;
}
