import Parser, { type Tree, type Language } from "web-tree-sitter";
import { readFileSync } from "node:fs";
import { ensureWasmFiles, getWasmPaths } from "./wasm-loader.js";
import { logger } from "../utils/logger.js";

let parserInstance: Parser | null = null;
let typescriptLanguage: Language | null = null;
let tsxLanguage: Language | null = null;
let initialized = false;

export async function initParser(): Promise<void> {
  if (initialized) return;

  try {
    // Ensure WASM files are downloaded
    const wasmPaths = getWasmPaths() || (await ensureWasmFiles());

    // Initialize the parser
    await Parser.init({
      locateFile: (scriptName: string) => {
        if (scriptName === "tree-sitter.wasm") {
          return wasmPaths.treeSitterPath;
        }
        return scriptName;
      },
    });

    parserInstance = new Parser();

    // Load TypeScript and TSX languages
    typescriptLanguage = await Parser.Language.load(wasmPaths.typescriptPath);
    tsxLanguage = await Parser.Language.load(wasmPaths.tsxPath);

    initialized = true;
    logger.debug("Tree-sitter parser initialized");
  } catch (error) {
    logger.error("Failed to initialize Tree-sitter parser", error);
    throw error;
  }
}

export function parseCode(code: string, isTSX: boolean = false): Tree {
  if (!parserInstance || !typescriptLanguage || !tsxLanguage) {
    throw new Error("Parser not initialized. Call initParser() first.");
  }

  parserInstance.setLanguage(isTSX ? tsxLanguage : typescriptLanguage);
  return parserInstance.parse(code);
}

export function parseFile(filePath: string): Tree {
  const content = readFileSync(filePath, "utf-8");
  const isTSX = filePath.endsWith(".tsx");
  return parseCode(content, isTSX);
}

export function isParserInitialized(): boolean {
  return initialized;
}

export { Tree, type Language };
export type { Parser };
