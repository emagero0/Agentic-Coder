/**
 * symbol-registry.ts — Symbolic Cognition Registry
 *
 * Defines compact symbolic references that agents can use in prompts
 * instead of full-text instructions. The compiler expands symbols
 * on demand, reducing baseline token cost.
 *
 * Usage in agent markdown:
 *   "Follow [naming-standard:v2] for all identifiers"
 *   → Expands to: "camelCase for functions, PascalCase for types, UPPER_SNAKE for constants"
 *
 * Design constraints:
 *   - Symbols are versioned (breaking changes require version bump)
 *   - Unexpanded symbols cost ~5 tokens instead of ~50+
 *   - Registry is read-only at runtime
 *   - No external dependencies
 */

// ── Types ──────────────────────────────────────────────────────────────────────

export interface SymbolEntry {
  /** Version tag for this symbol */
  version: string;
  /** Full expansion text */
  expansion: string;
  /** Category for grouping */
  category: "naming" | "security" | "testing" | "architecture" | "workflow";
  /** Approximate token cost of the expansion */
  expansion_tokens: number;
}

// ── Registry ───────────────────────────────────────────────────────────────────

const SYMBOL_REGISTRY: Record<string, SymbolEntry> = {
  "[naming-standard:v2]": {
    version: "v2",
    expansion:
      "camelCase for functions/variables, PascalCase for types/classes, " +
      "UPPER_SNAKE for constants, kebab-case for file names",
    category: "naming",
    expansion_tokens: 25,
  },
  "[security.auth:v3]": {
    version: "v3",
    expansion:
      "JWT only, no localStorage for tokens, rotate refresh tokens, " +
      "RBAC mandatory, validate all inputs server-side",
    category: "security",
    expansion_tokens: 30,
  },
  "[security.input:v2]": {
    version: "v2",
    expansion:
      "Validate all inputs at boundary, sanitize HTML output, " +
      "parameterize all SQL queries, reject unexpected content types",
    category: "security",
    expansion_tokens: 28,
  },
  "[error-handling:v2]": {
    version: "v2",
    expansion:
      "Use typed error classes, never catch-and-swallow, " +
      "log at boundary with correlation ID, return structured error responses",
    category: "architecture",
    expansion_tokens: 30,
  },
  "[test-pattern:v2]": {
    version: "v2",
    expansion:
      "Arrange-Act-Assert structure, mock external deps only, " +
      "test behavior not implementation, name tests as 'should {expected} when {condition}'",
    category: "testing",
    expansion_tokens: 32,
  },
  "[delegation-gate:v1]": {
    version: "v1",
    expansion:
      "Delegate when: 4+ files, specialized knowledge, multi-component review, " +
      "multi-step deps, fresh perspective needed. Execute directly: single file, clear fix",
    category: "workflow",
    expansion_tokens: 35,
  },
};

// ── API ────────────────────────────────────────────────────────────────────────

/**
 * Expand all symbolic references in a text string.
 * Replaces each [symbol:version] with its full expansion text.
 * Unknown symbols are left as-is (no error).
 */
export function expandSymbols(text: string): string {
  let result = text;
  for (const [symbol, entry] of Object.entries(SYMBOL_REGISTRY)) {
    if (result.includes(symbol)) {
      result = result.split(symbol).join(entry.expansion);
    }
  }
  return result;
}

/**
 * Check if a text contains any unexpanded symbolic references.
 * Returns the list of symbols found.
 */
export function findSymbols(text: string): string[] {
  return Object.keys(SYMBOL_REGISTRY).filter((s) => text.includes(s));
}

/**
 * Get a specific symbol entry by key.
 */
export function getSymbol(key: string): SymbolEntry | null {
  return SYMBOL_REGISTRY[key] ?? null;
}

/**
 * List all registered symbols with their metadata.
 * Useful for building agent documentation about available symbols.
 */
export function listSymbols(): Array<{ key: string } & SymbolEntry> {
  return Object.entries(SYMBOL_REGISTRY).map(([key, entry]) => ({
    key,
    ...entry,
  }));
}

/**
 * Calculate the token savings of using symbols vs full text.
 * Returns the number of tokens saved if all found symbols
 * are kept unexpanded instead of expanded.
 */
export function estimateSymbolSavings(text: string): {
  symbols_found: number;
  tokens_if_expanded: number;
  tokens_if_symbolic: number;
  savings: number;
} {
  const found = findSymbols(text);
  const tokensExpanded = found.reduce(
    (sum, s) => sum + (SYMBOL_REGISTRY[s]?.expansion_tokens ?? 0),
    0
  );
  const tokensSymbolic = found.length * 5; // ~5 tokens per symbolic ref

  return {
    symbols_found: found.length,
    tokens_if_expanded: tokensExpanded,
    tokens_if_symbolic: tokensSymbolic,
    savings: tokensExpanded - tokensSymbolic,
  };
}
