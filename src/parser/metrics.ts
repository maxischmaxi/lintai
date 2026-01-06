import type { Tree, SyntaxNode } from "web-tree-sitter";
import type { FileMetrics, FunctionMetrics } from "../types/context.js";

function countLines(code: string): { totalLines: number; codeLines: number } {
  const lines = code.split("\n");
  const totalLines = lines.length;

  let codeLines = 0;
  let inBlockComment = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Track block comments
    if (trimmed.startsWith("/*")) {
      inBlockComment = true;
    }
    if (trimmed.endsWith("*/")) {
      inBlockComment = false;
      continue;
    }

    if (inBlockComment) continue;

    // Skip empty lines and single-line comments
    if (trimmed === "" || trimmed.startsWith("//")) continue;

    codeLines++;
  }

  return { totalLines, codeLines };
}

function calculateNestingDepth(
  node: SyntaxNode,
  currentDepth: number = 0,
): number {
  let maxDepth = currentDepth;

  const nestingTypes = new Set([
    "if_statement",
    "for_statement",
    "for_in_statement",
    "while_statement",
    "do_statement",
    "switch_statement",
    "try_statement",
    "arrow_function",
    "function_expression",
    "function_declaration",
    "method_definition",
  ]);

  const incrementDepth = nestingTypes.has(node.type);
  const newDepth = incrementDepth ? currentDepth + 1 : currentDepth;

  if (incrementDepth) {
    maxDepth = Math.max(maxDepth, newDepth);
  }

  for (const child of node.children) {
    const childDepth = calculateNestingDepth(child, newDepth);
    maxDepth = Math.max(maxDepth, childDepth);
  }

  return maxDepth;
}

function estimateCyclomaticComplexity(node: SyntaxNode): number {
  // Start with 1 for the default path
  let complexity = 1;

  const complexityNodes = new Set([
    "if_statement",
    "for_statement",
    "for_in_statement",
    "while_statement",
    "do_statement",
    "switch_case",
    "catch_clause",
    "ternary_expression",
    "binary_expression", // for && and ||
  ]);

  function visit(n: SyntaxNode): void {
    if (complexityNodes.has(n.type)) {
      if (n.type === "binary_expression") {
        // Only count logical operators
        const operator = n.childForFieldName("operator")?.text;
        if (operator === "&&" || operator === "||") {
          complexity++;
        }
      } else {
        complexity++;
      }
    }

    for (const child of n.children) {
      visit(child);
    }
  }

  visit(node);
  return complexity;
}

function extractFunctionMetrics(tree: Tree, _code: string): FunctionMetrics[] {
  const functions: FunctionMetrics[] = [];

  function visit(node: SyntaxNode): void {
    const functionTypes = new Set([
      "function_declaration",
      "method_definition",
      "arrow_function",
      "function_expression",
    ]);

    if (functionTypes.has(node.type)) {
      let name = "anonymous";

      // Try to get function name
      const nameNode = node.childForFieldName("name");
      if (nameNode) {
        name = nameNode.text;
      } else if (node.parent?.type === "variable_declarator") {
        const parentNameNode = node.parent.childForFieldName("name");
        if (parentNameNode) {
          name = parentNameNode.text;
        }
      } else if (node.parent?.type === "pair") {
        // Object method: { methodName: () => {} }
        const keyNode = node.parent.childForFieldName("key");
        if (keyNode) {
          name = keyNode.text;
        }
      }

      const startLine = node.startPosition.row;
      const endLine = node.endPosition.row;
      const lineCount = endLine - startLine + 1;
      const maxNestingDepth = calculateNestingDepth(node);

      functions.push({
        name,
        startLine,
        endLine,
        lineCount,
        maxNestingDepth,
      });
    }

    for (const child of node.children) {
      visit(child);
    }
  }

  visit(tree.rootNode);
  return functions;
}

export function calculateMetrics(tree: Tree, code: string): FileMetrics {
  const { totalLines, codeLines } = countLines(code);
  const functions = extractFunctionMetrics(tree, code);
  const maxNestingDepth = calculateNestingDepth(tree.rootNode);
  const estimatedComplexity = estimateCyclomaticComplexity(tree.rootNode);

  const longestFunctionLines =
    functions.length > 0 ? Math.max(...functions.map((f) => f.lineCount)) : 0;

  return {
    totalLines,
    codeLines,
    maxNestingDepth,
    estimatedComplexity,
    functionCount: functions.length,
    longestFunctionLines,
    functions,
  };
}

export { calculateNestingDepth, estimateCyclomaticComplexity, countLines };
