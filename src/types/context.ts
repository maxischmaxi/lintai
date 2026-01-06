export interface ImportInfo {
  source: string;
  specifiers: string[];
  isRelative: boolean;
  line: number;
}

export interface DeclarationInfo {
  name: string;
  kind: "function" | "class" | "variable" | "interface" | "type" | "enum";
  startLine: number;
  endLine: number;
  exported: boolean;
}

export interface FunctionMetrics {
  name: string;
  startLine: number;
  endLine: number;
  lineCount: number;
  maxNestingDepth: number;
}

export interface FileMetrics {
  totalLines: number;
  codeLines: number;
  maxNestingDepth: number;
  estimatedComplexity: number;
  functionCount: number;
  longestFunctionLines: number;
  functions: FunctionMetrics[];
}

export interface AnalysisContext {
  filePath: string;
  content: string;
  imports: ImportInfo[];
  declarations: DeclarationInfo[];
  metrics: FileMetrics;
  snippets?: CodeSnippet[];
}

export interface CodeSnippet {
  code: string;
  startLine: number;
  endLine: number;
  context: string;
}
