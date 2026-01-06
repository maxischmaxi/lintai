import { logger } from "./logger.js";

/**
 * Attempts to extract JSON from a string using multiple strategies.
 * Returns null if all extraction attempts fail.
 */
export function extractJSON(text: string): unknown | null {
  // Strategy 1: Direct parse (text is pure JSON)
  try {
    return JSON.parse(text);
  } catch {
    logger.debug("Direct JSON parse failed, trying extraction strategies");
  }

  // Strategy 2: Extract from markdown code block ```json ... ```
  const jsonBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (jsonBlockMatch) {
    try {
      return JSON.parse(jsonBlockMatch[1].trim());
    } catch {
      logger.debug("JSON code block extraction failed");
    }
  }

  // Strategy 3: Find array brackets [ ... ]
  const arrayMatch = text.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    try {
      return JSON.parse(arrayMatch[0]);
    } catch {
      logger.debug("Array bracket extraction failed");
    }
  }

  // Strategy 4: Find object brackets { ... }
  const objectMatch = text.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    try {
      return JSON.parse(objectMatch[0]);
    } catch {
      logger.debug("Object bracket extraction failed");
    }
  }

  // Strategy 5: Try to find multiple JSON objects and combine into array
  const objectMatches = text.matchAll(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g);
  const objects: unknown[] = [];
  for (const match of objectMatches) {
    try {
      objects.push(JSON.parse(match[0]));
    } catch {
      // Skip invalid objects
    }
  }
  if (objects.length > 0) {
    return objects;
  }

  logger.warn("All JSON extraction strategies failed");
  return null;
}

/**
 * Validates and extracts JSON, returning a default value on failure.
 */
export function extractJSONWithDefault<T>(text: string, defaultValue: T): T {
  const result = extractJSON(text);
  if (result === null) {
    return defaultValue;
  }
  return result as T;
}
