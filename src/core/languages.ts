/**
 * Simple language detection and configuration.
 * No tree-sitter, just extension-based detection with language-specific prompt rules.
 */

export interface LanguageConfig {
  id: string;
  name: string;
  extensions: string[];
  promptInstructions: string;
}

/**
 * Language configurations with prompt instructions.
 */
const languages: LanguageConfig[] = [
  {
    id: "typescript",
    name: "TypeScript",
    extensions: [".ts", ".tsx", ".js", ".jsx"],
    promptInstructions: `You are analyzing TypeScript/JavaScript code. Pay attention to:
- Type safety: Watch for 'any' type abuse and unsafe type assertions
- Async/await patterns: Look for unhandled promises and missing error handling
- Null/undefined handling: Missing optional chaining or nullish coalescing
- React patterns (for .tsx/.jsx): Component structure, hooks rules`,
  },
  {
    id: "go",
    name: "Go",
    extensions: [".go"],
    promptInstructions: `You are analyzing Go code. Pay special attention to:
- Error handling: EVERY error must be checked. Look for _ = err or missing if err != nil
- Context propagation: Functions doing I/O should accept context.Context as first param
- Goroutines: Check for proper synchronization, channel handling, and goroutine leaks
- Defer patterns: Resources (files, mutexes, connections) should use defer for cleanup
- Interface design: Prefer small interfaces. Avoid interface{}/any unless necessary`,
  },
  {
    id: "python",
    name: "Python",
    extensions: [".py"],
    promptInstructions: `You are analyzing Python code. Pay attention to:
- Type hints: Missing or incorrect type annotations
- Exception handling: Bare except clauses, swallowed exceptions
- Resource management: Missing context managers (with statements)
- Mutable default arguments: Lists/dicts as default parameter values`,
  },
  {
    id: "rust",
    name: "Rust",
    extensions: [".rs"],
    promptInstructions: `You are analyzing Rust code. Pay attention to:
- Error handling: Proper use of Result and Option, unwrap() abuse
- Memory safety: Unnecessary clones, lifetime issues
- Concurrency: Proper use of Arc, Mutex, channels`,
  },
  {
    id: "java",
    name: "Java",
    extensions: [".java"],
    promptInstructions: `You are analyzing Java code. Pay attention to:
- Null safety: Missing null checks, potential NullPointerException
- Resource management: Missing try-with-resources
- Exception handling: Empty catch blocks, catching generic Exception`,
  },
];

/**
 * Extension to language mapping for fast lookup.
 */
const extensionMap = new Map<string, LanguageConfig>();
for (const lang of languages) {
  for (const ext of lang.extensions) {
    extensionMap.set(ext, lang);
  }
}

/**
 * Get language config by file extension.
 */
export function getLanguageForExtension(
  ext: string,
): LanguageConfig | undefined {
  return extensionMap.get(ext);
}

/**
 * Get language config by file path.
 */
export function getLanguageForFile(
  filePath: string,
): LanguageConfig | undefined {
  const ext = filePath.slice(filePath.lastIndexOf("."));
  return getLanguageForExtension(ext);
}

/**
 * Check if a file extension is supported.
 */
export function isExtensionSupported(ext: string): boolean {
  return extensionMap.has(ext);
}

/**
 * Get all supported extensions.
 */
export function getSupportedExtensions(): string[] {
  return Array.from(extensionMap.keys());
}
