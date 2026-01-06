import {
  Diagnostic,
  DiagnosticSeverity,
  Range,
  Position,
} from "vscode-languageserver";
import type { Finding, FindingSeverity } from "../types/finding.js";
import type { SeverityConfig } from "../types/config.js";

const SEVERITY_MAP: Record<FindingSeverity, DiagnosticSeverity> = {
  error: DiagnosticSeverity.Error,
  warning: DiagnosticSeverity.Warning,
  info: DiagnosticSeverity.Information,
  hint: DiagnosticSeverity.Hint,
};

/**
 * Adjust severity based on confidence and thresholds.
 */
function adjustSeverity(
  finding: Finding,
  config: SeverityConfig,
): DiagnosticSeverity {
  // If finding already has a severity, use it but potentially downgrade based on confidence
  const baseSeverity = SEVERITY_MAP[finding.severity];

  if (finding.confidence >= config.highConfidenceThreshold) {
    // High confidence - keep original severity
    return baseSeverity;
  } else if (finding.confidence >= config.mediumConfidenceThreshold) {
    // Medium confidence - downgrade errors to warnings, warnings to info
    if (baseSeverity === DiagnosticSeverity.Error) {
      return DiagnosticSeverity.Warning;
    } else if (baseSeverity === DiagnosticSeverity.Warning) {
      return DiagnosticSeverity.Information;
    }
    return baseSeverity;
  } else {
    // Low confidence - everything becomes hint
    return DiagnosticSeverity.Hint;
  }
}

/**
 * Create a Range for a diagnostic.
 */
function createRange(finding: Finding, lineCount: number): Range {
  if (finding.range) {
    return Range.create(
      Position.create(
        Math.min(finding.range.startLine, lineCount - 1),
        finding.range.startCharacter,
      ),
      Position.create(
        Math.min(finding.range.endLine, lineCount - 1),
        finding.range.endCharacter,
      ),
    );
  }

  // No range provided - use first line
  return Range.create(Position.create(0, 0), Position.create(0, 1));
}

/**
 * Convert a Finding to an LSP Diagnostic.
 */
export function findingToDiagnostic(
  finding: Finding,
  severityConfig: SeverityConfig,
  lineCount: number = 1,
): Diagnostic {
  const severity = adjustSeverity(finding, severityConfig);
  const range = createRange(finding, lineCount);

  // Build message with suggestion
  let message = finding.message;
  if (finding.suggestion) {
    message += `\n\nSuggestion: ${finding.suggestion}`;
  }

  return {
    range,
    severity,
    code: finding.id,
    source: "lintai",
    message,
    data: {
      category: finding.category,
      confidence: finding.confidence,
      title: finding.title,
    },
  };
}

/**
 * Convert multiple Findings to LSP Diagnostics.
 */
export function findingsToDiagnostics(
  findings: Finding[],
  severityConfig: SeverityConfig,
  lineCount: number = 1,
): Diagnostic[] {
  return findings.map((finding) =>
    findingToDiagnostic(finding, severityConfig, lineCount),
  );
}

/**
 * Create an error diagnostic for system issues (e.g., LLM unavailable).
 */
export function createErrorDiagnostic(
  message: string,
  severity: DiagnosticSeverity = DiagnosticSeverity.Information,
): Diagnostic {
  return {
    range: Range.create(Position.create(0, 0), Position.create(0, 1)),
    severity,
    source: "lintai",
    message,
    code: "SYSTEM",
  };
}

/**
 * Category to human-readable string.
 */
export function categoryToString(category: string): string {
  const map: Record<string, string> = {
    smell: "Code Smell",
    practice: "Bad Practice",
    spaghetti: "Spaghetti Code",
    naming: "Naming Issue",
    safety: "Type Safety",
  };
  return map[category] ?? category;
}
