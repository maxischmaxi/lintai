import type { AnalysisContext } from "../types/context.js";
import type { RulesConfig } from "../types/config.js";

export function buildSystemPrompt(rules: RulesConfig): string {
  const enabledRules: string[] = [];

  if (rules.codeSmells) {
    enabledRules.push(
      `- CODE SMELLS: Long functions (>50 lines), deep nesting (>4 levels), god objects, feature envy, large classes`,
    );
  }
  if (rules.badPractices) {
    enabledRules.push(
      `- BAD PRACTICES: Missing error handling, magic numbers/strings, mutable global state, side effects in getters`,
    );
  }
  if (rules.spaghetti) {
    enabledRules.push(
      `- SPAGHETTI CODE: Unclear control flow, excessive conditionals, callback hell, deeply nested promises`,
    );
  }
  if (rules.naming) {
    enabledRules.push(
      `- NAMING: Unclear variable/function names, inconsistent conventions, single-letter names (except loop counters), misleading names`,
    );
  }
  if (rules.errorHandling) {
    enabledRules.push(
      `- ERROR HANDLING: Empty catch blocks, swallowed errors, missing async/await error handling, unchecked null/undefined`,
    );
  }
  if (rules.anyAbuse) {
    enabledRules.push(
      `- TYPE SAFETY: Explicit 'any' type, type assertions without validation, missing null checks, implicit any`,
    );
  }

  return `You are a TypeScript code quality analyzer. Your task is to identify genuine code issues and return structured findings.

## Categories to check:
${enabledRules.join("\n")}

## Rules:
- Be precise and actionable - every finding must have a clear fix
- Only report real issues, not style preferences
- Include specific line numbers (0-indexed) when possible
- Set confidence 0.0-1.0 based on how certain you are
- Prioritize issues that could cause bugs or maintenance problems
- Do NOT flag stylistic choices or personal preferences
- Do NOT include explanations outside the JSON

## Severity Guidelines:
- error: Critical issues that will likely cause bugs or security problems
- warning: Issues that hurt maintainability or could cause future bugs
- info: Suggestions for improvement
- hint: Minor recommendations

## Output format:
Return ONLY a valid JSON array of findings. No markdown, no explanations, just JSON.
Each finding must have: id, title, severity, message, suggestion, category, confidence, and optionally range.`;
}

export function buildUserPrompt(context: AnalysisContext): string {
  const { metrics, imports, declarations, content, snippets } = context;

  // Build metrics section
  const metricsSection = `## File Metrics:
- Total lines: ${metrics.totalLines}
- Code lines: ${metrics.codeLines}
- Max nesting depth: ${metrics.maxNestingDepth}
- Estimated complexity: ${metrics.estimatedComplexity}
- Function count: ${metrics.functionCount}
- Longest function: ${metrics.longestFunctionLines} lines`;

  // Build imports section
  const importsSection =
    imports.length > 0
      ? `## Imports:
${imports.map((i) => `- ${i.source} (${i.specifiers.join(", ")})`).join("\n")}`
      : "## Imports:\nNone";

  // Build declarations section
  const declarationsSection =
    declarations.length > 0
      ? `## Declarations:
${declarations.map((d) => `- ${d.kind} ${d.name} (lines ${d.startLine}-${d.endLine})${d.exported ? " [exported]" : ""}`).join("\n")}`
      : "## Declarations:\nNone";

  // Build code section (snippets or full file)
  let codeSection: string;
  if (snippets && snippets.length > 0) {
    codeSection = `## Code Snippets:
${snippets
  .map(
    (s) => `### ${s.context} (lines ${s.startLine}-${s.endLine}):
\`\`\`typescript
${s.code}
\`\`\``,
  )
  .join("\n\n")}`;
  } else {
    codeSection = `## Full Code:
\`\`\`typescript
${content}
\`\`\``;
  }

  // Build the complete prompt
  return `Analyze this TypeScript code for quality issues.

${metricsSection}

${importsSection}

${declarationsSection}

${codeSection}

Return findings as a JSON array with this structure:
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
