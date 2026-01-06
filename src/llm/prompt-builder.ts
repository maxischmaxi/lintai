import type { RulesConfig } from "../types/config.js";
import { getLanguageForExtension } from "../core/languages.js";

/**
 * Build the system prompt for code analysis.
 */
export function buildSystemPrompt(
  rules: RulesConfig,
  languageId?: string,
): string {
  const lang = languageId
    ? getLanguageForExtension(`.${languageId}`) || getLanguageById(languageId)
    : null;
  const langName = lang?.name || "code";

  // Build rules list
  const enabledRules: string[] = [];

  if (rules.codeSmells) {
    enabledRules.push(
      "- CODE SMELLS: Long functions (>50 lines), deep nesting (>4 levels), god objects, large classes",
    );
  }
  if (rules.badPractices) {
    enabledRules.push(
      "- BAD PRACTICES: Missing error handling, magic numbers/strings, mutable global state",
    );
  }
  if (rules.spaghetti) {
    enabledRules.push(
      "- SPAGHETTI CODE: Unclear control flow, excessive conditionals, deeply nested callbacks",
    );
  }
  if (rules.naming) {
    enabledRules.push(
      "- NAMING: Unclear variable/function names, inconsistent conventions, misleading names",
    );
  }
  if (rules.errorHandling) {
    enabledRules.push(
      "- ERROR HANDLING: Empty catch blocks, swallowed errors, missing error handling",
    );
  }
  if (rules.anyAbuse && languageId === "typescript") {
    enabledRules.push(
      "- TYPE SAFETY: Explicit 'any' type, unsafe type assertions, missing null checks",
    );
  }

  const langInstructions = lang?.promptInstructions || "";

  return `You are a ${langName} code quality analyzer. Identify genuine code issues and return structured findings.

## Categories to check:
${enabledRules.join("\n")}

${langInstructions ? `## Language-specific guidance:\n${langInstructions}\n` : ""}
## Rules:
- Be precise and actionable - every finding must have a clear fix
- Only report real issues, not style preferences
- Include specific line numbers (1-indexed) when possible
- Set confidence 0.0-1.0 based on certainty
- Prioritize issues that could cause bugs or maintenance problems

## Severity Guidelines:
- error: Critical issues likely to cause bugs or security problems
- warning: Issues that hurt maintainability or could cause future bugs
- info: Suggestions for improvement
- hint: Minor recommendations

## Output format:
Return ONLY a valid JSON array of findings. No markdown, no explanations, just JSON.`;
}

/**
 * Build user prompt with the code to analyze.
 */
export function buildUserPrompt(
  filePath: string,
  content: string,
  languageId?: string,
): string {
  const lang = languageId
    ? getLanguageForExtension(`.${languageId}`) || getLanguageById(languageId)
    : null;
  const langName = lang?.id || "code";
  const lineCount = content.split("\n").length;

  return `Analyze this ${lang?.name || "code"} file for quality issues.

File: ${filePath}
Lines: ${lineCount}

\`\`\`${langName}
${content}
\`\`\`

Return findings as a JSON array:
[
  {
    "id": "AI001",
    "title": "Short descriptive title",
    "severity": "warning",
    "message": "Detailed explanation of the issue",
    "suggestion": "Specific recommendation to fix it",
    "category": "smell",
    "confidence": 0.85,
    "range": {
      "startLine": 10,
      "startCharacter": 0,
      "endLine": 15,
      "endCharacter": 1
    }
  }
]

Categories: smell, practice, spaghetti, naming, safety
Severities: error, warning, info, hint

Respond with ONLY the JSON array, no other text.`;
}

/**
 * Helper to get language by ID (for when we pass "go" instead of ".go")
 */
function getLanguageById(id: string) {
  const extMap: Record<string, string> = {
    typescript: ".ts",
    go: ".go",
    python: ".py",
    rust: ".rs",
    java: ".java",
  };
  const ext = extMap[id];
  return ext ? getLanguageForExtension(ext) : undefined;
}
