import { describe, it, expect } from "vitest";
import {
  extractJSON,
  extractJSONWithDefault,
} from "../src/utils/json-extract.js";

describe("extractJSON", () => {
  it("should parse pure JSON", () => {
    const result = extractJSON('[{"id": "1"}]');
    expect(result).toEqual([{ id: "1" }]);
  });

  it("should extract JSON from markdown code block", () => {
    const text = `Here is the result:
\`\`\`json
[{"id": "AI001", "title": "Test"}]
\`\`\`
`;
    const result = extractJSON(text);
    expect(result).toEqual([{ id: "AI001", title: "Test" }]);
  });

  it("should extract array from text", () => {
    const text = 'The findings are: [{"id": "1"}, {"id": "2"}] as expected.';
    const result = extractJSON(text);
    expect(result).toEqual([{ id: "1" }, { id: "2" }]);
  });

  it("should extract object from text", () => {
    const text = 'Result: {"key": "value"}';
    const result = extractJSON(text);
    expect(result).toEqual({ key: "value" });
  });

  it("should return null for invalid JSON", () => {
    const result = extractJSON("This is not JSON at all");
    expect(result).toBeNull();
  });

  it("should handle nested JSON structures", () => {
    const json = JSON.stringify({
      findings: [{ id: "1", range: { start: 0, end: 10 } }],
    });
    const result = extractJSON(json);
    expect(result).toEqual({
      findings: [{ id: "1", range: { start: 0, end: 10 } }],
    });
  });
});

describe("extractJSONWithDefault", () => {
  it("should return parsed JSON on success", () => {
    const result = extractJSONWithDefault("[1, 2, 3]", []);
    expect(result).toEqual([1, 2, 3]);
  });

  it("should return default value on failure", () => {
    const result = extractJSONWithDefault("invalid", ["default"]);
    expect(result).toEqual(["default"]);
  });
});
