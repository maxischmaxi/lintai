import { describe, it, expect, beforeEach } from "vitest";
import { parseResponse, resetIdCounter } from "../src/llm/response-parser.js";

describe("parseResponse", () => {
  beforeEach(() => {
    resetIdCounter();
  });

  it("should parse valid findings array", () => {
    const response = JSON.stringify([
      {
        id: "AI001",
        title: "Long Function",
        severity: "warning",
        message: "Function is too long",
        suggestion: "Break it up",
        category: "smell",
        confidence: 0.9,
        range: {
          startLine: 10,
          startCharacter: 0,
          endLine: 20,
          endCharacter: 1,
        },
      },
    ]);

    const result = parseResponse(response);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].id).toBe("AI001");
    expect(result.findings[0].severity).toBe("warning");
    expect(result.parseError).toBeUndefined();
  });

  it("should handle markdown-wrapped JSON", () => {
    const response = `Here are the findings:
\`\`\`json
[
  {
    "id": "AI001",
    "title": "Test Issue",
    "severity": "info",
    "message": "Test message",
    "suggestion": "Test suggestion",
    "category": "practice",
    "confidence": 0.8
  }
]
\`\`\`
`;
    const result = parseResponse(response);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].title).toBe("Test Issue");
  });

  it("should sanitize invalid severity values", () => {
    const response = JSON.stringify([
      {
        id: "AI001",
        title: "Test",
        severity: "critical", // Invalid
        message: "Test",
        suggestion: "Test",
        category: "smell",
        confidence: 0.5,
      },
    ]);

    const result = parseResponse(response);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].severity).toBe("warning"); // Defaulted
  });

  it("should clamp confidence values", () => {
    const response = JSON.stringify([
      {
        id: "AI001",
        title: "Test",
        severity: "info",
        message: "Test",
        suggestion: "Test",
        category: "smell",
        confidence: 1.5, // Out of range
      },
    ]);

    const result = parseResponse(response);
    expect(result.findings[0].confidence).toBe(1);
  });

  it("should handle empty response", () => {
    const result = parseResponse("[]");
    expect(result.findings).toHaveLength(0);
    expect(result.parseError).toBeUndefined();
  });

  it("should report parse error for invalid JSON", () => {
    const result = parseResponse("This is not JSON");
    expect(result.findings).toHaveLength(0);
    expect(result.parseError).toBeDefined();
  });

  it("should handle missing optional range", () => {
    const response = JSON.stringify([
      {
        id: "AI001",
        title: "Test",
        severity: "info",
        message: "Test",
        suggestion: "Test",
        category: "practice",
        confidence: 0.7,
      },
    ]);

    const result = parseResponse(response);
    expect(result.findings[0].range).toBeUndefined();
  });
});
