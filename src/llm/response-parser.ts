import { FindingsArraySchema, type Finding } from "../types/finding.js";
import { extractJSON } from "../utils/json-extract.js";
import { logger } from "../utils/logger.js";

export interface ParseResult {
  findings: Finding[];
  parseError?: string;
  rawResponse?: string;
}

/**
 * Parse and validate the LLM response into findings.
 */
export function parseResponse(response: string): ParseResult {
  const result: ParseResult = {
    findings: [],
    rawResponse: response,
  };

  // Try to extract JSON from response
  const extracted = extractJSON(response);

  if (extracted === null) {
    result.parseError = "Failed to extract JSON from LLM response";
    logger.warn(result.parseError);
    return result;
  }

  // Ensure we have an array
  const dataArray = Array.isArray(extracted) ? extracted : [extracted];

  // Validate against schema
  const validated = FindingsArraySchema.safeParse(dataArray);

  if (!validated.success) {
    logger.warn("Schema validation failed:", validated.error.issues);

    // Try to salvage valid findings
    const salvaged: Finding[] = [];
    for (const item of dataArray) {
      try {
        const finding = sanitizeFinding(item);
        if (finding) {
          salvaged.push(finding);
        }
      } catch {
        // Skip invalid findings
      }
    }

    if (salvaged.length > 0) {
      result.findings = salvaged;
      result.parseError = `Partial parse: ${salvaged.length}/${dataArray.length} findings valid`;
    } else {
      result.parseError = "No valid findings in LLM response";
    }

    return result;
  }

  result.findings = validated.data;
  return result;
}

/**
 * Attempt to fix/normalize a single finding object.
 */
function sanitizeFinding(raw: unknown): Finding | null {
  if (typeof raw !== "object" || raw === null) {
    return null;
  }

  const obj = raw as Record<string, unknown>;

  // Required fields with defaults
  const id = typeof obj["id"] === "string" ? obj["id"] : generateId();
  const title =
    typeof obj["title"] === "string" ? obj["title"] : "Untitled Issue";
  const message = typeof obj["message"] === "string" ? obj["message"] : "";
  const suggestion =
    typeof obj["suggestion"] === "string"
      ? obj["suggestion"]
      : "Review this code section";

  // Severity with fallback
  let severity: "error" | "warning" | "info" | "hint" = "warning";
  if (typeof obj["severity"] === "string") {
    const sev = obj["severity"].toLowerCase();
    if (["error", "warning", "info", "hint"].includes(sev)) {
      severity = sev as typeof severity;
    }
  }

  // Category with fallback
  let category: "smell" | "practice" | "spaghetti" | "naming" | "safety" =
    "practice";
  if (typeof obj["category"] === "string") {
    const cat = obj["category"].toLowerCase();
    if (["smell", "practice", "spaghetti", "naming", "safety"].includes(cat)) {
      category = cat as typeof category;
    }
  }

  // Confidence with bounds
  let confidence = 0.5;
  if (typeof obj["confidence"] === "number") {
    confidence = Math.max(0, Math.min(1, obj["confidence"]));
  }

  // Range (optional)
  let range: Finding["range"] = undefined;
  if (typeof obj["range"] === "object" && obj["range"] !== null) {
    const r = obj["range"] as Record<string, unknown>;
    if (
      typeof r["startLine"] === "number" &&
      typeof r["startCharacter"] === "number" &&
      typeof r["endLine"] === "number" &&
      typeof r["endCharacter"] === "number"
    ) {
      range = {
        startLine: Math.max(0, Math.floor(r["startLine"])),
        startCharacter: Math.max(0, Math.floor(r["startCharacter"])),
        endLine: Math.max(0, Math.floor(r["endLine"])),
        endCharacter: Math.max(0, Math.floor(r["endCharacter"])),
      };
    }
  }

  // Skip findings without meaningful content
  if (!message && !title) {
    return null;
  }

  return {
    id,
    title,
    severity,
    message,
    suggestion,
    category,
    confidence,
    range,
  };
}

let idCounter = 0;
function generateId(): string {
  return `AI${String(++idCounter).padStart(3, "0")}`;
}

/**
 * Reset the ID counter (useful for testing).
 */
export function resetIdCounter(): void {
  idCounter = 0;
}
