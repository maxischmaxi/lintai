Entwickle ein NPM-installierbares Tool in TypeScript/JavaScript, das sowohl (a) als CLI wie ESLint und (b) als LSP-Server (für Neovim) läuft. Das Tool analysiert TypeScript-Dateien und ruft über eine konfigurierbare HTTP-Schnittstelle (z. B. OpenAI-kompatibel) ein LLM auf, um Bad Practices, Code Smells, Spaghetti Code und andere Qualitätsprobleme zu finden. Tree-sitter soll für AST/Parsing verwendet werden (mindestens für robuste Extraktion von Imports/Top-Level-Struktur, optional für gezielte Kontext-Erzeugung). Das Tool muss schnell, deterministisch in der Integration und sicher im Umgang mit Code sein.

WICHTIG: Du sollst zuerst einen perfekten Umsetzungsplan liefern (Architektur, Module, Datenfluss, LSP/CLI UX, Sicherheit), dann die Implementierung mit sauberem Repo-Layout, und am Ende eine “How to use in Neovim”-Anleitung plus Beispielkonfiguration.

## 1) Produktanforderungen (MVP)

- Sprache: TypeScript (Runtime Node.js), Veröffentlichung auf npm.
- Ein einziges Paket, eine CLI: `ailint`
- Zwei Modi:
  1. CLI: `ailint path/to/file.ts` oder `ailint .` (rekursiv, optional).
  2. LSP: `ailint --lsp` startet Language Server über stdio.
- Neovim Integration: muss mit `nvim-lspconfig` nutzbar sein.
- Fokus: Diagnostics (Warnungen/Fehler) in Editor anzeigen. Optional: CodeActions (Quickfixes) als V2.
- Analysiere mindestens die aktuell geöffnete Datei (LSP `textDocument/didOpen`, `didChange`, `didSave`).
- Erzeuge LLM-Requests nur, wenn nötig: Debounce, Cache, Rate-limit, nur bei sinnvoller Änderung.
- Output: LSP Diagnostics mit Range, Severity, Message, optional Code/Source.
- Konfiguration per:
  - CLI Flags
  - config file (z. B. `.ailintrc.json`)
  - Environment Variables (für API Key)
- LLM API: OpenAI-kompatibel per Base URL + Model + Key, alles konfigurierbar.
- Datenschutz: Standardmäßig niemals mehr Kontext als nötig senden; klare Option, um “full-file” vs “snippet-based” zu steuern.

## 2) Nicht-Ziele (für MVP)

- Kein vollständiger Ersatz für TypeScript Language Service.
- Keine Autocomplete/Hover/Definition Features.
- Keine multi-file deep semantic analysis (optional später).
- Keine Cloud-Abhängigkeit außer dem konfigurierten HTTP LLM Endpoint.

## 3) Kern-Designprinzipien

- Deterministischer “Pre-Processor”: Tree-sitter extrahiert Struktur + relevante Snippets, sodass das LLM nicht frei halluziniert.
- LLM soll strukturierte Ausgabe liefern: JSON Schema mit Findings (id, title, severity, message, range, suggestion, category, confidence).
- Robustheit: JSON parsing tolerant (z. B. JSON5 fallback oder “extract JSON from text”), aber am Ende muss intern valides Schema stehen.
- Performance: inkrementelles Parsing (Tree-sitter), Debounce bei didChange (z. B. 500–800ms), Cache pro (filePath + contentHash + configHash).
- Sicherheit: Kein arbitrary code execution. Keine Dateisystem-Leaks. Pfade und Inhalte nur nach expliziter Policy.
- UX: Diagnose-Nachrichten kurz + konkret, mit minimalem “AI fluff”. Jede Diagnose soll eine eindeutige Empfehlung enthalten.

## 4) Implementierungsplan, den du liefern sollst

Du lieferst zuerst einen Plan mit:

- Repo-Struktur (packages, src layout)
- Abhängigkeiten (z. B. `vscode-languageserver`, `vscode-languageserver-textdocument`, `yargs`/`commander`, `tree-sitter`, `tree-sitter-typescript`, `zod` für Schema)
- Module:
  - LSP Server (stdio)
  - CLI Runner
  - Document Store + Debounce/Caching
  - Tree-sitter Parser + Kontext-Builder
  - Prompt Builder
  - LLM Client (OpenAI-compatible)
  - Findings -> Diagnostics Mapper
  - Config Loader (rc + env + flags)
  - Logging/Tracing (optional, aber debug friendly)
- Datenfluss (LSP didOpen/didChange -> parse -> context -> LLM -> findings -> diagnostics)
- Konfigurationsschema (welche Optionen es gibt)
- Error handling (API down, JSON invalid, timeouts)
- Teststrategie:
  - Unit Tests für Parser/Context builder
  - Unit Tests für Findings->Diagnostics mapping
  - Integration test “CLI on fixture file”
  - (Optional) mock LLM server

## 5) Tree-sitter Nutzung (konkret für MVP)

- Du musst Tree-sitter einsetzen, um:
  - Imports zu extrahieren (module specifiers)
  - Top-Level Declarations zu listen (functions/classes)
  - Ranges/Positions (line/character) zuverlässig zu bekommen
- Optional, wenn machbar:
  - “changed region” detection, um nur Snippets zu senden statt ganze Datei.

Wenn du Imports “auflösen” willst:

- MVP: Nur lokale relative Imports (`./` `../`) und nur “exists check” + optional reading of imported file contents falls `--include-imports` gesetzt ist.
- Standard: Keine zusätzlichen Dateien senden.

## 6) LLM Prompting (konkret)

- Entwirf ein System prompt + user prompt.
- User prompt enthält:
  - Regeln/Definitionen: Bad Practices, Smells, Spaghetti Indikatoren (konkret: lange Funktionen, tiefe Nesting, implizite side effects, fehlende error handling, unklare naming, any abuse, etc.)
  - Output strikt im JSON-Format nach Schema.
  - Kontext: (a) optional full file oder (b) kompakter Kontext: Imports + relevant sections + metrics
- Erzeuge zusätzlich heuristische, lokale Metriken ohne LLM:
  - LOC, nesting depth, cyclomatic estimate (heuristisch), function length
    Diese Metriken gehen ebenfalls in den Prompt und dienen als “grounding”.

## 7) Diagnostik-Mapping

- Findings müssen auf LSP Diagnostic gemappt werden:
  - severity mapping: error/warning/info/hint
  - range: start/end line/char (0-based)
  - source: z. B. `ailint`
  - code: stable id (z. B. `AI001`)
- Falls Range fehlt: fallback auf (0,0)-(0,1) oder file-level diagnostic am Anfang, aber kennzeichnen.
- Du sollst klare Regeln implementieren, wie du “confidence” in severity übersetzt.

## 8) CLI UX

- `ailint file.ts` -> print human readable + optional `--json` Ausgabe
- `ailint . --ext ts,tsx --max-files 200` (optional)
- `ailint --lsp` -> startet LSP server
- `ailint --init` -> erzeugt config template (optional)
- Exit codes:
  - 0: keine findings >= threshold
  - 1: findings vorhanden
  - 2: runtime/config errors

## 9) Neovim Anleitung (muss am Ende enthalten sein)

- Beispiel für `nvim-lspconfig`:
  - `cmd = { "ailint", "--lsp" }`
  - `filetypes = { "typescript", "typescriptreact" }`
  - root_dir detection (git root / package.json)
- Hinweise zu Installation:
  - global npm install oder via project local + `npx ailint --lsp`

## 10) Qualitätsbar / Acceptance Criteria

- MVP funktioniert end-to-end:
  - `npm i -g <pkg>` dann `ailint --lsp` läuft
  - Neovim zeigt Diagnostics in TS Datei, nach Edit mit Debounce
  - CLI scan einer Datei liefert Findings
- LLM requests sind konfigurierbar (baseUrl, model, key)
- Tool fällt robust zurück, wenn LLM nicht erreichbar ist (Diagnostic “LLM unavailable” als Info, kein Crash)
- Code ist sauber, typed, gut dokumentiert (README, config docs).
- Keine unnötigen Dependencies, keine komplizierte Build Chain: tsup/esbuild oder plain tsc + minimal bundling.

## 11) Lieferumfang, den du erzeugen sollst

1. Perfekter Plan (detailliert, aber umsetzungsorientiert)
2. Repo Implementation (alle Dateien)
3. README mit:
   - Install/Usage
   - Config
   - Neovim Setup
   - Troubleshooting
4. Beispiele:
   - `.ailintrc.json`
   - fixture TypeScript file + expected output (test)
5. (Optional) GitHub Actions CI: lint/test/build.

Lege los mit dem Plan, danach implementiere iterativ. Achte auf gute Defaults, saubere Fehlertexte, und darauf, dass das Tool ohne Editor auch als CLI wertvoll ist.
