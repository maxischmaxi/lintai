import { describe, it, expect } from "vitest";
import { DiagnosticSeverity } from "vscode-languageserver";
import {
  findingToDiagnostic,
  findingsToDiagnostics,
  createErrorDiagnostic,
} from "../src/core/diagnostics-mapper.js";
import type { Finding } from "../src/types/finding.js";

describe("findingToDiagnostic", () => {
  const defaultSeverityConfig = {
    highConfidenceThreshold: 0.8,
    mediumConfidenceThreshold: 0.5,
  };

  it("should convert finding to diagnostic", () => {
    const finding: Finding = {
      id: "AI001",
      title: "Test Issue",
      severity: "warning",
      message: "This is a test issue",
      suggestion: "Fix it",
      category: "smell",
      confidence: 0.9,
      range: {
        startLine: 10,
        startCharacter: 0,
        endLine: 15,
        endCharacter: 1,
      },
    };

    const diagnostic = findingToDiagnostic(finding, defaultSeverityConfig, 100);

    expect(diagnostic.severity).toBe(DiagnosticSeverity.Warning);
    expect(diagnostic.code).toBe("AI001");
    expect(diagnostic.source).toBe("lintai");
    expect(diagnostic.range.start.line).toBe(10);
    expect(diagnostic.range.end.line).toBe(15);
    expect(diagnostic.message).toContain("This is a test issue");
    expect(diagnostic.message).toContain("Fix it");
  });

  it("should downgrade severity for low confidence", () => {
    const finding: Finding = {
      id: "AI002",
      title: "Low Confidence Issue",
      severity: "error",
      message: "Might be an issue",
      suggestion: "Check it",
      category: "practice",
      confidence: 0.3, // Below medium threshold
    };

    const diagnostic = findingToDiagnostic(finding, defaultSeverityConfig, 100);

    expect(diagnostic.severity).toBe(DiagnosticSeverity.Hint);
  });

  it("should downgrade error to warning for medium confidence", () => {
    const finding: Finding = {
      id: "AI003",
      title: "Medium Confidence Issue",
      severity: "error",
      message: "Probably an issue",
      suggestion: "Fix it",
      category: "safety",
      confidence: 0.6, // Medium confidence
    };

    const diagnostic = findingToDiagnostic(finding, defaultSeverityConfig, 100);

    expect(diagnostic.severity).toBe(DiagnosticSeverity.Warning);
  });

  it("should use fallback range when none provided", () => {
    const finding: Finding = {
      id: "AI004",
      title: "No Range",
      severity: "info",
      message: "File-level issue",
      suggestion: "Check file",
      category: "smell",
      confidence: 0.8,
    };

    const diagnostic = findingToDiagnostic(finding, defaultSeverityConfig, 100);

    expect(diagnostic.range.start.line).toBe(0);
    expect(diagnostic.range.start.character).toBe(0);
    expect(diagnostic.range.end.line).toBe(0);
    expect(diagnostic.range.end.character).toBe(1);
  });

  it("should clamp range to file bounds", () => {
    const finding: Finding = {
      id: "AI005",
      title: "Out of bounds",
      severity: "warning",
      message: "Issue",
      suggestion: "Fix",
      category: "practice",
      confidence: 0.9,
      range: {
        startLine: 100,
        startCharacter: 0,
        endLine: 200,
        endCharacter: 1,
      },
    };

    const diagnostic = findingToDiagnostic(finding, defaultSeverityConfig, 50);

    expect(diagnostic.range.start.line).toBe(49); // Clamped to lineCount - 1
    expect(diagnostic.range.end.line).toBe(49);
  });
});

describe("findingsToDiagnostics", () => {
  it("should convert multiple findings", () => {
    const findings: Finding[] = [
      {
        id: "AI001",
        title: "Issue 1",
        severity: "warning",
        message: "First issue",
        suggestion: "Fix 1",
        category: "smell",
        confidence: 0.9,
      },
      {
        id: "AI002",
        title: "Issue 2",
        severity: "error",
        message: "Second issue",
        suggestion: "Fix 2",
        category: "safety",
        confidence: 0.95,
      },
    ];

    const severityConfig = {
      highConfidenceThreshold: 0.8,
      mediumConfidenceThreshold: 0.5,
    };

    const diagnostics = findingsToDiagnostics(findings, severityConfig, 100);

    expect(diagnostics).toHaveLength(2);
    expect(diagnostics[0].code).toBe("AI001");
    expect(diagnostics[1].code).toBe("AI002");
  });
});

describe("createErrorDiagnostic", () => {
  it("should create system error diagnostic", () => {
    const diagnostic = createErrorDiagnostic("LLM unavailable");

    expect(diagnostic.source).toBe("lintai");
    expect(diagnostic.code).toBe("SYSTEM");
    expect(diagnostic.message).toBe("LLM unavailable");
    expect(diagnostic.severity).toBe(DiagnosticSeverity.Information);
  });

  it("should accept custom severity", () => {
    const diagnostic = createErrorDiagnostic(
      "Critical error",
      DiagnosticSeverity.Error,
    );

    expect(diagnostic.severity).toBe(DiagnosticSeverity.Error);
  });
});
