import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  InitializeResult,
  TextDocumentSyncKind,
  DiagnosticSeverity,
} from "vscode-languageserver/node.js";
import { TextDocument } from "vscode-languageserver-textdocument";
import { loadConfig, getConfigHash, validateAPIKey } from "../config/loader.js";
import { getGlobalDocumentStore } from "../core/document-store.js";
import { analyze, initParser } from "../core/analyzer.js";
import {
  findingsToDiagnostics,
  createErrorDiagnostic,
} from "../core/diagnostics-mapper.js";
import { debounce } from "../core/debounce.js";
import { logger } from "../utils/logger.js";
import type { AilintConfig } from "../types/config.js";

export function startLSPServer(): void {
  // Create connection for stdio (explicitly set stdin/stdout)
  const connection = createConnection(
    ProposedFeatures.all,
    process.stdin,
    process.stdout,
  );

  // Create document manager
  const documents = new TextDocuments(TextDocument);

  // State
  let config: AilintConfig;
  let rootUri: string | null = null;
  const documentStore = getGlobalDocumentStore();

  // Debounced analysis function per document
  type DebouncedFn = ReturnType<typeof debounce<(uri: string) => void>>;
  const analysisQueue = new Map<string, DebouncedFn>();

  // Set up LSP mode for logger
  logger.setLSPMode(true);

  connection.onInitialize(
    async (params: InitializeParams): Promise<InitializeResult> => {
      rootUri = params.rootUri || params.workspaceFolders?.[0]?.uri || null;

      // Load config
      const rootPath = rootUri ? new URL(rootUri).pathname : process.cwd();
      config = loadConfig(rootPath);

      if (config.debug) {
        logger.setLevel("debug");
      }

      documentStore.setConfigHash(getConfigHash(config));

      // Validate API key
      const apiKeyValidation = validateAPIKey(config);
      if (!apiKeyValidation.valid && apiKeyValidation.message) {
        logger.warn(apiKeyValidation.message);
      }

      // Initialize parser
      try {
        await initParser();
        logger.info("Parser initialized");
      } catch (error) {
        logger.error("Failed to initialize parser:", error);
      }

      logger.info("lintai LSP server initialized");

      return {
        capabilities: {
          textDocumentSync: {
            openClose: true,
            change: TextDocumentSyncKind.Full,
            save: { includeText: true },
          },
        },
      };
    },
  );

  connection.onInitialized(() => {
    logger.info("LSP connection initialized");
  });

  // Document opened
  documents.onDidOpen((event) => {
    const uri = event.document.uri;
    logger.debug(`Document opened: ${uri}`);

    // Store document
    documentStore.set(uri, event.document.getText());

    // Check cache first
    const cached = documentStore.getCachedFindings(uri);
    if (cached) {
      const diagnostics = findingsToDiagnostics(
        cached,
        config.severity,
        event.document.lineCount,
      );
      connection.sendDiagnostics({ uri, diagnostics });
      return;
    }

    // Trigger analysis
    triggerAnalysis(uri, event.document.getText(), event.document.lineCount);
  });

  // Document changed
  documents.onDidChangeContent((event) => {
    const uri = event.document.uri;
    logger.debug(`Document changed: ${uri}`);

    // Update document store
    documentStore.set(uri, event.document.getText());

    // Debounced analysis
    getOrCreateDebouncedAnalysis(uri)(uri);
  });

  // Document saved
  documents.onDidSave((event) => {
    const uri = event.document.uri;
    logger.debug(`Document saved: ${uri}`);

    // Flush any pending debounced analysis
    const debouncedFn = analysisQueue.get(uri);
    if (debouncedFn) {
      debouncedFn.flush();
    }
  });

  // Document closed
  documents.onDidClose((event) => {
    const uri = event.document.uri;
    logger.debug(`Document closed: ${uri}`);

    // Cancel pending analysis
    const debouncedFn = analysisQueue.get(uri);
    if (debouncedFn) {
      debouncedFn.cancel();
      analysisQueue.delete(uri);
    }

    // Clear diagnostics
    connection.sendDiagnostics({ uri, diagnostics: [] });

    // Remove from store
    documentStore.delete(uri);
  });

  function getOrCreateDebouncedAnalysis(uri: string): DebouncedFn {
    let debouncedFn = analysisQueue.get(uri);

    if (!debouncedFn) {
      debouncedFn = debounce((docUri: string) => {
        const doc = documents.get(docUri);
        if (doc) {
          triggerAnalysis(docUri, doc.getText(), doc.lineCount);
        }
      }, config.performance.debounceMs);

      analysisQueue.set(uri, debouncedFn);
    }

    return debouncedFn;
  }

  async function triggerAnalysis(
    uri: string,
    content: string,
    lineCount: number,
  ): Promise<void> {
    const entry = documentStore.get(uri);
    if (!entry) return;

    // Prevent concurrent analysis of same document
    if (entry.analyzing) {
      logger.debug(`Analysis already in progress for ${uri}`);
      return;
    }

    documentStore.setAnalyzing(uri, true);

    try {
      // Check API key
      const apiKeyValidation = validateAPIKey(config);
      if (!apiKeyValidation.valid) {
        const diagnostic = createErrorDiagnostic(
          apiKeyValidation.message || "API key not configured",
          DiagnosticSeverity.Warning,
        );
        connection.sendDiagnostics({ uri, diagnostics: [diagnostic] });
        return;
      }

      // Get file path from URI
      const filePath = new URL(uri).pathname;

      // Run analysis
      const result = await analyze({
        filePath,
        content,
        config,
      });

      // Store findings
      documentStore.setFindings(uri, result.findings);

      // Convert to diagnostics
      const diagnostics = findingsToDiagnostics(
        result.findings,
        config.severity,
        lineCount,
      );

      // Add error diagnostic if analysis had issues
      if (result.error) {
        diagnostics.push(
          createErrorDiagnostic(result.error, DiagnosticSeverity.Information),
        );
      }

      // Send diagnostics
      connection.sendDiagnostics({ uri, diagnostics });

      logger.debug(
        `Analysis complete for ${uri}: ${result.findings.length} findings`,
      );
    } catch (error) {
      logger.error(`Analysis failed for ${uri}:`, error);

      const errorMessage =
        error instanceof Error ? error.message : "Analysis failed";
      const diagnostic = createErrorDiagnostic(
        errorMessage,
        DiagnosticSeverity.Warning,
      );
      connection.sendDiagnostics({ uri, diagnostics: [diagnostic] });
    } finally {
      documentStore.setAnalyzing(uri, false);
    }
  }

  // Listen to document events
  documents.listen(connection);

  // Start listening
  connection.listen();
}
