import type { Finding } from "../types/finding.js";
import type { AnalysisResult } from "../core/analyzer.js";
import { categoryToString } from "../core/diagnostics-mapper.js";

const COLORS = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
};

const SEVERITY_COLORS: Record<string, string> = {
  error: COLORS.red,
  warning: COLORS.yellow,
  info: COLORS.blue,
  hint: COLORS.cyan,
};

const SEVERITY_ICONS: Record<string, string> = {
  error: "✖",
  warning: "⚠",
  info: "ℹ",
  hint: "💡",
};

function colorize(text: string, color: string, useColor: boolean): string {
  return useColor ? `${color}${text}${COLORS.reset}` : text;
}

export interface FormatOptions {
  useColor?: boolean;
  showMetrics?: boolean;
}

export function formatFinding(
  finding: Finding,
  filePath: string,
  options: FormatOptions = {},
): string {
  const { useColor = true } = options;
  const lines: string[] = [];

  const sevColor = SEVERITY_COLORS[finding.severity] || COLORS.gray;
  const icon = SEVERITY_ICONS[finding.severity] || "•";

  // Location
  const location = finding.range
    ? `${filePath}:${finding.range.startLine + 1}:${finding.range.startCharacter + 1}`
    : filePath;

  // Header: location + severity + code
  const header = `${colorize(location, COLORS.bold, useColor)} ${colorize(`${icon} ${finding.severity}`, sevColor, useColor)} ${colorize(`[${finding.id}]`, COLORS.dim, useColor)}`;
  lines.push(header);

  // Title
  lines.push(`  ${colorize(finding.title, COLORS.bold, useColor)}`);

  // Message
  lines.push(`  ${finding.message}`);

  // Suggestion
  if (finding.suggestion) {
    lines.push(
      `  ${colorize("→", COLORS.cyan, useColor)} ${finding.suggestion}`,
    );
  }

  // Category and confidence
  const meta = `${categoryToString(finding.category)} • confidence: ${Math.round(finding.confidence * 100)}%`;
  lines.push(`  ${colorize(meta, COLORS.dim, useColor)}`);

  return lines.join("\n");
}

export function formatResults(
  filePath: string,
  result: AnalysisResult,
  options: FormatOptions = {},
): string {
  const { useColor = true, showMetrics = false } = options;
  const lines: string[] = [];

  // File header
  lines.push("");
  lines.push(colorize(`━━━ ${filePath} ━━━`, COLORS.bold, useColor));

  if (result.error) {
    lines.push(colorize(`  ⚠ ${result.error}`, COLORS.yellow, useColor));
  }

  if (result.findings.length === 0) {
    lines.push(colorize("  ✓ No issues found", COLORS.cyan, useColor));
  } else {
    for (const finding of result.findings) {
      lines.push("");
      lines.push(formatFinding(finding, filePath, options));
    }
  }

  // Metrics
  if (showMetrics && result.metrics) {
    lines.push("");
    lines.push(
      colorize(
        `  LLM: ${result.metrics.llmTimeMs}ms | Total: ${result.metrics.totalTimeMs}ms`,
        COLORS.dim,
        useColor,
      ),
    );
  }

  return lines.join("\n");
}

export function formatSummary(
  totalFiles: number,
  totalFindings: number,
  bySerity: Record<string, number>,
  options: FormatOptions = {},
): string {
  const { useColor = true } = options;
  const lines: string[] = [];

  lines.push("");
  lines.push(colorize("━━━ Summary ━━━", COLORS.bold, useColor));

  lines.push(`  Files analyzed: ${totalFiles}`);
  lines.push(`  Total issues: ${totalFindings}`);

  if (totalFindings > 0) {
    const parts: string[] = [];
    if (bySerity["error"]) {
      parts.push(colorize(`${bySerity["error"]} errors`, COLORS.red, useColor));
    }
    if (bySerity["warning"]) {
      parts.push(
        colorize(`${bySerity["warning"]} warnings`, COLORS.yellow, useColor),
      );
    }
    if (bySerity["info"]) {
      parts.push(colorize(`${bySerity["info"]} info`, COLORS.blue, useColor));
    }
    if (bySerity["hint"]) {
      parts.push(colorize(`${bySerity["hint"]} hints`, COLORS.cyan, useColor));
    }
    lines.push(`  ${parts.join(", ")}`);
  }

  return lines.join("\n");
}

export interface JSONOutput {
  files: Array<{
    path: string;
    findings: Finding[];
    error?: string;
  }>;
  summary: {
    totalFiles: number;
    totalFindings: number;
    bySeverity: Record<string, number>;
  };
}

export function formatJSON(results: Map<string, AnalysisResult>): string {
  const output: JSONOutput = {
    files: [],
    summary: {
      totalFiles: results.size,
      totalFindings: 0,
      bySeverity: {},
    },
  };

  for (const [path, result] of results) {
    output.files.push({
      path,
      findings: result.findings,
      error: result.error,
    });

    output.summary.totalFindings += result.findings.length;

    for (const finding of result.findings) {
      output.summary.bySeverity[finding.severity] =
        (output.summary.bySeverity[finding.severity] || 0) + 1;
    }
  }

  return JSON.stringify(output, null, 2);
}
