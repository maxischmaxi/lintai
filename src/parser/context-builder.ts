import type { Tree, SyntaxNode } from "web-tree-sitter";
import type {
  ImportInfo,
  DeclarationInfo,
  AnalysisContext,
  CodeSnippet,
} from "../types/context.js";
import { calculateMetrics } from "./metrics.js";
import { logger } from "../utils/logger.js";

function extractImports(tree: Tree, _code: string): ImportInfo[] {
  const imports: ImportInfo[] = [];
  const rootNode = tree.rootNode;

  function visit(node: SyntaxNode): void {
    if (node.type === "import_statement") {
      const sourceNode = node.childForFieldName("source");
      const source = sourceNode
        ? sourceNode.text.replace(/^['"]|['"]$/g, "")
        : "";

      const specifiers: string[] = [];

      // Extract import specifiers
      for (const child of node.children) {
        if (child.type === "import_clause") {
          for (const clauseChild of child.children) {
            if (clauseChild.type === "identifier") {
              // Default import
              specifiers.push(clauseChild.text);
            } else if (clauseChild.type === "named_imports") {
              // Named imports { a, b, c }
              for (const namedChild of clauseChild.children) {
                if (namedChild.type === "import_specifier") {
                  const nameNode =
                    namedChild.childForFieldName("alias") ||
                    namedChild.childForFieldName("name");
                  if (nameNode) {
                    specifiers.push(nameNode.text);
                  }
                }
              }
            } else if (clauseChild.type === "namespace_import") {
              // import * as X
              const nameNode = clauseChild.childForFieldName("name");
              if (nameNode) {
                specifiers.push(`* as ${nameNode.text}`);
              }
            }
          }
        }
      }

      imports.push({
        source,
        specifiers,
        isRelative: source.startsWith("."),
        line: node.startPosition.row,
      });
    }

    for (const child of node.children) {
      visit(child);
    }
  }

  visit(rootNode);
  return imports;
}

function extractDeclarations(tree: Tree): DeclarationInfo[] {
  const declarations: DeclarationInfo[] = [];
  const rootNode = tree.rootNode;

  function isExported(node: SyntaxNode): boolean {
    const parent = node.parent;
    if (!parent) return false;
    return parent.type === "export_statement";
  }

  function visit(node: SyntaxNode, depth: number = 0): void {
    // Only process top-level declarations (depth 0 or 1 for exports)
    if (depth > 1) return;

    let declaration: DeclarationInfo | null = null;

    switch (node.type) {
      case "function_declaration": {
        const nameNode = node.childForFieldName("name");
        if (nameNode) {
          declaration = {
            name: nameNode.text,
            kind: "function",
            startLine: node.startPosition.row,
            endLine: node.endPosition.row,
            exported: isExported(node),
          };
        }
        break;
      }

      case "class_declaration": {
        const nameNode = node.childForFieldName("name");
        if (nameNode) {
          declaration = {
            name: nameNode.text,
            kind: "class",
            startLine: node.startPosition.row,
            endLine: node.endPosition.row,
            exported: isExported(node),
          };
        }
        break;
      }

      case "lexical_declaration":
      case "variable_declaration": {
        for (const child of node.children) {
          if (child.type === "variable_declarator") {
            const nameNode = child.childForFieldName("name");
            if (nameNode) {
              declaration = {
                name: nameNode.text,
                kind: "variable",
                startLine: node.startPosition.row,
                endLine: node.endPosition.row,
                exported: isExported(node),
              };
              declarations.push(declaration);
            }
          }
        }
        return; // Already handled
      }

      case "interface_declaration": {
        const nameNode = node.childForFieldName("name");
        if (nameNode) {
          declaration = {
            name: nameNode.text,
            kind: "interface",
            startLine: node.startPosition.row,
            endLine: node.endPosition.row,
            exported: isExported(node),
          };
        }
        break;
      }

      case "type_alias_declaration": {
        const nameNode = node.childForFieldName("name");
        if (nameNode) {
          declaration = {
            name: nameNode.text,
            kind: "type",
            startLine: node.startPosition.row,
            endLine: node.endPosition.row,
            exported: isExported(node),
          };
        }
        break;
      }

      case "enum_declaration": {
        const nameNode = node.childForFieldName("name");
        if (nameNode) {
          declaration = {
            name: nameNode.text,
            kind: "enum",
            startLine: node.startPosition.row,
            endLine: node.endPosition.row,
            exported: isExported(node),
          };
        }
        break;
      }

      case "export_statement": {
        // Process children with incremented depth
        for (const child of node.children) {
          visit(child, depth + 1);
        }
        return;
      }
    }

    if (declaration) {
      declarations.push(declaration);
    }

    // Only recurse into program node at top level
    if (node.type === "program") {
      for (const child of node.children) {
        visit(child, depth);
      }
    }
  }

  visit(rootNode);
  return declarations;
}

function extractSnippets(
  _tree: Tree,
  code: string,
  declarations: DeclarationInfo[],
): CodeSnippet[] {
  const snippets: CodeSnippet[] = [];
  const lines = code.split("\n");

  for (const decl of declarations) {
    if (decl.kind === "function" || decl.kind === "class") {
      const snippetLines = lines.slice(decl.startLine, decl.endLine + 1);
      snippets.push({
        code: snippetLines.join("\n"),
        startLine: decl.startLine,
        endLine: decl.endLine,
        context: `${decl.kind} ${decl.name}`,
      });
    }
  }

  return snippets;
}

export function buildContext(
  filePath: string,
  code: string,
  tree: Tree,
  mode: "full-file" | "snippet" = "snippet",
): AnalysisContext {
  logger.debug(`Building context for ${filePath} in ${mode} mode`);

  const imports = extractImports(tree, code);
  const declarations = extractDeclarations(tree);
  const metrics = calculateMetrics(tree, code);

  const context: AnalysisContext = {
    filePath,
    content: code,
    imports,
    declarations,
    metrics,
  };

  if (mode === "snippet") {
    context.snippets = extractSnippets(tree, code, declarations);
  }

  return context;
}

export { extractImports, extractDeclarations, extractSnippets };
