import { Command } from "commander";
import { runCLI, type CLIArgs } from "./cli/index.js";
import { startLSPServer } from "./lsp/server.js";
import { loadConfig, validateAPIKey } from "./config/loader.js";
import type { LLMProvider } from "./types/config.js";
import { ENV_VAR_MAPPINGS } from "./config/defaults.js";

const COLORS = {
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
};

function checkAPIKey(options: {
  config?: string;
  provider?: string;
  baseUrl?: string;
}): boolean {
  const config = loadConfig(process.cwd(), {
    config: options.config,
    provider: options.provider as LLMProvider | undefined,
    baseUrl: options.baseUrl,
  });

  const validation = validateAPIKey(config);

  if (!validation.valid) {
    const provider = validation.provider;
    const envVars = ENV_VAR_MAPPINGS[provider] || ["LINTAI_API_KEY"];

    console.error(
      `${COLORS.red}${COLORS.bold}Error: API key not configured for ${provider}${COLORS.reset}\n`,
    );
    console.error(
      `${COLORS.yellow}To fix this, do one of the following:${COLORS.reset}\n`,
    );

    // Provider-specific env var suggestions
    console.error(`  1. Set environment variable:`);
    for (const envVar of envVars) {
      console.error(
        `     ${COLORS.bold}export ${envVar}=your-api-key${COLORS.reset}`,
      );
    }
    console.error("");

    // Provider-specific setup suggestions
    if (provider === "openai") {
      console.error(`  2. Or create ${COLORS.cyan}lintai.json${COLORS.reset}:`);
      console.error(`     ${COLORS.dim}{`);
      console.error(`       "llm": {`);
      console.error(`         "provider": "openai",`);
      console.error(`         "apiKey": "sk-..."${COLORS.reset}`);
      console.error(`${COLORS.dim}       }`);
      console.error(`     }${COLORS.reset}\n`);
    } else if (provider === "anthropic") {
      console.error(`  2. Or create ${COLORS.cyan}lintai.json${COLORS.reset}:`);
      console.error(`     ${COLORS.dim}{`);
      console.error(`       "llm": {`);
      console.error(`         "provider": "anthropic",`);
      console.error(`         "apiKey": "sk-ant-..."${COLORS.reset}`);
      console.error(`${COLORS.dim}       }`);
      console.error(`     }${COLORS.reset}\n`);
    } else if (provider === "gemini") {
      console.error(`  2. Or create ${COLORS.cyan}lintai.json${COLORS.reset}:`);
      console.error(`     ${COLORS.dim}{`);
      console.error(`       "llm": {`);
      console.error(`         "provider": "gemini",`);
      console.error(`         "apiKey": "..."${COLORS.reset}`);
      console.error(`${COLORS.dim}       }`);
      console.error(`     }${COLORS.reset}\n`);
    }

    console.error(`  3. Or for local Ollama (no key needed):`);
    console.error(
      `     ${COLORS.bold}lintai --provider ollama${COLORS.reset}\n`,
    );

    console.error(`  4. Or generate a config template:`);
    console.error(`     ${COLORS.bold}lintai --init${COLORS.reset}\n`);

    return false;
  }

  return true;
}

const program = new Command();

program
  .name("lintai")
  .description("AI-powered TypeScript linter using LLM analysis")
  .version("0.1.0")
  .argument("[paths...]", "Files or directories to analyze")
  .option("--lsp", "Start as Language Server Protocol server")
  .option("--init", "Create lintai.json config file")
  .option("--json", "Output results as JSON")
  .option("--debug", "Enable debug logging")
  .option("-c, --config <path>", "Path to config file")
  .option(
    "--ext <extensions>",
    "File extensions to analyze (comma-separated)",
    "ts,tsx",
  )
  .option("--max-files <number>", "Maximum number of files to analyze", "100")
  .option("--model <model>", "LLM model to use")
  .option("--base-url <url>", "LLM API base URL")
  .option(
    "--provider <provider>",
    "LLM provider (openai, anthropic, gemini, ollama, openai-compatible)",
  )
  .action(async (paths: string[], options) => {
    // --init doesn't need API key
    if (options.init) {
      const args: CLIArgs = {
        paths: [],
        lsp: false,
        init: true,
        json: false,
        debug: false,
      };
      const exitCode = await runCLI(args);
      process.exit(exitCode);
    }

    // Check API key before starting LSP or analysis
    if (!checkAPIKey(options)) {
      process.exit(2);
    }

    // LSP mode
    if (options.lsp) {
      startLSPServer();
      return;
    }

    // CLI mode
    const args: CLIArgs = {
      paths: paths.length > 0 ? paths : ["."],
      lsp: false,
      init: false,
      json: options.json ?? false,
      debug: options.debug ?? false,
      config: options.config,
      ext: options.ext,
      maxFiles: parseInt(options.maxFiles, 10),
      model: options.model,
      baseUrl: options.baseUrl,
      provider: options.provider as LLMProvider | undefined,
    };

    const exitCode = await runCLI(args);
    process.exit(exitCode);
  });

program.parse();
