# lintai

AI-powered TypeScript linter using LLM analysis. Detects code smells, bad practices, spaghetti code, and other quality issues.

## Features

- **Multiple LLM Providers**: OpenAI, Anthropic (Claude), Google Gemini, Ollama
- **CLI Mode**: Analyze files from the command line, like ESLint
- **LSP Mode**: Real-time analysis in your editor (Neovim, VS Code, etc.)
- **Smart Context**: Tree-sitter parsing for accurate code analysis
- **Configurable**: Extensive options via `lintai.json` config file
- **Rate Limited**: Built-in rate limiting to avoid API quota issues

## Installation

```bash
npm install -g lintai
```

Or use locally in a project:

```bash
npm install --save-dev lintai
```

## Quick Start

### 1. Create a config file

```bash
lintai --init
```

This creates an `lintai.json` in your project.

### 2. Set your API key

```bash
# For OpenAI
export OPENAI_API_KEY=sk-your-api-key

# For Anthropic
export ANTHROPIC_API_KEY=sk-ant-your-api-key

# For Google Gemini
export GEMINI_API_KEY=your-api-key

# For Ollama (no key needed)
# Just make sure Ollama is running locally
```

### 3. Run lintai

```bash
# Analyze a single file
lintai src/index.ts

# Analyze a directory
lintai src/

# Output as JSON
lintai src/ --json
```

## Configuration

Create an `lintai.json` in your project root:

### OpenAI Configuration

```json
{
  "llm": {
    "provider": "openai",
    "model": "gpt-4o-mini"
  }
}
```

**Environment variable:** `OPENAI_API_KEY` or `LINTAI_API_KEY`

**Available models:** `gpt-4o`, `gpt-4o-mini`, `gpt-4-turbo`, `gpt-3.5-turbo`

### Anthropic (Claude) Configuration

```json
{
  "llm": {
    "provider": "anthropic",
    "model": "claude-sonnet-4-20250514"
  }
}
```

**Environment variable:** `ANTHROPIC_API_KEY` or `LINTAI_API_KEY`

**Available models:** `claude-sonnet-4-20250514`, `claude-3-5-sonnet-20241022`, `claude-3-haiku-20240307`

### Google Gemini Configuration

```json
{
  "llm": {
    "provider": "gemini",
    "model": "gemini-2.0-flash"
  }
}
```

**Environment variable:** `GEMINI_API_KEY`, `GOOGLE_API_KEY`, or `LINTAI_API_KEY`

**Available models:** `gemini-2.0-flash`, `gemini-1.5-pro`, `gemini-1.5-flash`

## Local LLM Setup (Free, Private, No API Key)

Running lintai with a local LLM gives you **free, private code analysis** without sending your code to external servers.

### Option 1: LM Studio (Recommended for Beginners)

[LM Studio](https://lmstudio.ai/) is a desktop app that makes running local LLMs easy.

**Step 1: Install LM Studio**

Download from [lmstudio.ai](https://lmstudio.ai/) (Windows, macOS, Linux)

**Step 2: Download a Model**

In LM Studio, go to the "Discover" tab and download one of these recommended models:

| Model                       | Size   | RAM Required | Quality                    |
| --------------------------- | ------ | ------------ | -------------------------- |
| `Qwen2.5-Coder-7B-Instruct` | 4.5 GB | 8 GB         | ⭐⭐⭐⭐⭐ Best for code   |
| `DeepSeek-Coder-V2-Lite`    | 9 GB   | 12 GB        | ⭐⭐⭐⭐⭐ Excellent       |
| `CodeLlama-7B-Instruct`     | 4 GB   | 8 GB         | ⭐⭐⭐⭐ Good              |
| `Llama-3.2-3B-Instruct`     | 2 GB   | 6 GB         | ⭐⭐⭐ Fast, lower quality |

**Step 3: Start the Server**

1. Go to the "Local Server" tab (left sidebar)
2. Select your downloaded model
3. Click "Start Server"
4. Server runs on `http://localhost:1234`

**Step 4: Configure lintai**

```json
{
  "llm": {
    "provider": "openai-compatible",
    "baseUrl": "http://localhost:1234/v1",
    "model": "qwen2.5-coder-7b-instruct",
    "timeout": 60000,
    "maxTokens": 4096
  }
}
```

### Option 2: Ollama (Lightweight CLI)

[Ollama](https://ollama.ai/) is a command-line tool for running LLMs locally.

**Step 1: Install Ollama**

```bash
# macOS / Linux
curl -fsSL https://ollama.ai/install.sh | sh

# Windows: Download from https://ollama.ai/download
```

**Step 2: Download a Model**

```bash
# Recommended: Qwen 2.5 Coder (best for code analysis)
ollama pull qwen2.5-coder:7b

# Alternative: CodeLlama
ollama pull codellama:7b

# Smaller/faster option
ollama pull qwen2.5-coder:3b
```

**Step 3: Start Ollama**

```bash
# Ollama runs automatically after install
# Or start manually:
ollama serve
```

**Step 4: Configure lintai**

```json
{
  "llm": {
    "provider": "ollama",
    "baseUrl": "http://localhost:11434",
    "model": "qwen2.5-coder:7b",
    "timeout": 60000,
    "maxTokens": 4096
  }
}
```

### Recommended Local Models

For code analysis, we recommend these models (in order of quality):

| Model                 | Provider  | Command / Download             | Min RAM |
| --------------------- | --------- | ------------------------------ | ------- |
| **Qwen2.5-Coder-7B**  | Ollama    | `ollama pull qwen2.5-coder:7b` | 8 GB    |
| **Qwen2.5-Coder-7B**  | LM Studio | Search "Qwen2.5-Coder"         | 8 GB    |
| **DeepSeek-Coder-V2** | LM Studio | Search "DeepSeek-Coder"        | 12 GB   |
| **CodeLlama-7B**      | Ollama    | `ollama pull codellama:7b`     | 8 GB    |
| **Qwen2.5-Coder-3B**  | Ollama    | `ollama pull qwen2.5-coder:3b` | 6 GB    |

**Tips:**

- 7B models offer the best balance of quality and speed
- 3B models are faster but may miss subtle issues
- 13B+ models are slower but more accurate
- GPU acceleration significantly improves speed

### OpenAI-Compatible Endpoints

lintai works with any OpenAI-compatible API server:

```json
{
  "llm": {
    "provider": "openai-compatible",
    "baseUrl": "http://localhost:8080/v1",
    "model": "your-model-name",
    "apiKey": "optional-api-key"
  }
}
```

**Compatible servers:** LM Studio, Ollama, vLLM, LocalAI, llama.cpp server, text-generation-webui

### Full Configuration Reference

```json
{
  "llm": {
    "provider": "openai",
    "model": "gpt-4o-mini",
    "baseUrl": "https://api.openai.com/v1",
    "timeout": 30000,
    "maxTokens": 2048
  },
  "analysis": {
    "mode": "snippet",
    "includeImports": false,
    "maxFileSize": 100000
  },
  "rules": {
    "codeSmells": true,
    "badPractices": true,
    "spaghetti": true,
    "naming": true,
    "errorHandling": true,
    "anyAbuse": true
  },
  "severity": {
    "highConfidenceThreshold": 0.8,
    "mediumConfidenceThreshold": 0.5
  },
  "performance": {
    "debounceMs": 600,
    "rateLimitPerMinute": 10,
    "rateLimitEnabled": true
  },
  "debug": false
}
```

## CLI Usage

```
lintai [paths...] [options]

Arguments:
  paths                      Files or directories to analyze (default: ".")

Options:
  --lsp                      Start as Language Server Protocol server
  --init                     Create lintai.json config file
  --json                     Output results as JSON
  --debug                    Enable debug logging
  -c, --config <path>        Path to config file
  --ext <extensions>         File extensions to analyze (default: "ts,tsx")
  --max-files <number>       Maximum files to analyze (default: 100)
  --model <model>            LLM model to use
  --base-url <url>           LLM API base URL
  --provider <provider>      LLM provider (openai, anthropic, gemini, ollama)
  -V, --version              Output version number
  -h, --help                 Display help
```

### Examples

```bash
# Analyze with specific provider
lintai src/ --provider anthropic

# Use a specific model
lintai src/ --model gpt-4

# Use Ollama locally
lintai src/ --provider ollama --model codellama

# Create config file
lintai --init
```

## Neovim Setup

### Prerequisites

- Neovim 0.8+
- `nvim-lspconfig` plugin

### Installation

1. Install lintai globally:

   ```bash
   npm install -g lintai
   ```

2. Add to your Neovim config:

```lua
-- lua/plugins/lsp.lua or init.lua

local lspconfig = require('lspconfig')
local configs = require('lspconfig.configs')

-- Register lintai as a custom LSP
if not configs.lintai then
  configs.lintai = {
    default_config = {
      cmd = { 'lintai', '--lsp' },
      filetypes = { 'typescript', 'typescriptreact' },
      root_dir = lspconfig.util.root_pattern(
        'lintai.json',
        'package.json',
        'tsconfig.json',
        '.git'
      ),
      settings = {},
    },
  }
end

-- Enable the server
lspconfig.lintai.setup({
  on_attach = function(client, bufnr)
    -- Optional: Custom keybindings
    vim.keymap.set('n', '<leader>ai', function()
      vim.diagnostic.open_float()
    end, { buffer = bufnr, desc = 'Show AI lint diagnostics' })
  end,
})
```

### Alternative: Project-local with npx

```lua
configs.lintai = {
  default_config = {
    cmd = { 'npx', 'lintai', '--lsp' },
    -- ... rest of config
  },
}
```

## What It Detects

| Category           | Examples                                                          |
| ------------------ | ----------------------------------------------------------------- |
| **Code Smells**    | Long functions (>50 lines), deep nesting (>4 levels), god objects |
| **Bad Practices**  | Missing error handling, magic numbers, mutable global state       |
| **Spaghetti Code** | Unclear control flow, callback hell, excessive conditionals       |
| **Naming Issues**  | Unclear names, single-letter variables, inconsistent conventions  |
| **Type Safety**    | `any` type abuse, missing null checks, unsafe type assertions     |
| **Error Handling** | Empty catch blocks, swallowed errors, unchecked promises          |

## Exit Codes

| Code | Meaning                        |
| ---- | ------------------------------ |
| 0    | No issues found                |
| 1    | Issues found                   |
| 2    | Configuration or runtime error |

## Environment Variables

| Variable            | Description                       |
| ------------------- | --------------------------------- |
| `LINTAI_API_KEY`    | API key (works for all providers) |
| `OPENAI_API_KEY`    | OpenAI API key                    |
| `ANTHROPIC_API_KEY` | Anthropic API key                 |
| `GEMINI_API_KEY`    | Google Gemini API key             |
| `GOOGLE_API_KEY`    | Alternative for Gemini            |
| `LINTAI_PROVIDER`   | Default provider                  |
| `LINTAI_MODEL`      | Default model                     |
| `LINTAI_BASE_URL`   | Custom API base URL               |
| `LINTAI_DEBUG`      | Enable debug mode (true/1)        |

## Troubleshooting

### "API key not configured"

Set the appropriate environment variable for your provider:

```bash
# OpenAI
export OPENAI_API_KEY=sk-...

# Anthropic
export ANTHROPIC_API_KEY=sk-ant-...

# Gemini
export GEMINI_API_KEY=...
```

Or add `apiKey` to your `lintai.json`.

### "Failed to initialize parser"

The first run downloads Tree-sitter WASM files. Ensure you have internet access:

```bash
ls ~/.cache/lintai/wasm/
```

### LSP not working in Neovim

1. Check if lintai is installed: `which lintai`
2. Check LSP logs: `:LspLog`
3. Verify config: `:LspInfo`
4. Ensure `lintai.json` exists in project root

### Rate limiting

If you see rate limit errors, you can reduce the request rate or disable rate limiting entirely:

```json
{
  "performance": {
    "rateLimitPerMinute": 5,
    "rateLimitEnabled": false
  }
}
```

## Development

```bash
# Clone and install
git clone https://github.com/your/lintai
cd lintai
npm install

# Build
npm run build

# Run tests
npm test

# Development mode
npm run dev
```

## License

MIT
