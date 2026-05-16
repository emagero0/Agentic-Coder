/** symbol-registry.test.ts — Pure logic, no mocks needed */
import { describe, it, expect } from "vitest";
import { expandSymbols, findSymbols, getSymbol, listSymbols, estimateSymbolSavings } from "../../tool/prompt-compiler/symbol-registry.js";

describe("symbol-registry", () => {
  it("should expand known symbols", () => {
    expect(expandSymbols("[naming-standard:v2]")).toContain("camelCase");
    expect(expandSymbols("[security.auth:v3]")).toContain("JWT");
    expect(expandSymbols("[error-handling:v2]")).toContain("typed error");
    expect(expandSymbols("[test-pattern:v2]")).toContain("Arrange-Act-Assert");
    expect(expandSymbols("[delegation-gate:v1]")).toContain("Delegate when");
  });

  it("should leave unknown symbols unchanged", () => {
    expect(expandSymbols("[unknown-symbol:v1]")).toBe("[unknown-symbol:v1]");
  });

  it("should expand multiple symbols in one text", () => {
    const result = expandSymbols("Use [naming-standard:v2] and [security.auth:v3]");
    expect(result).toContain("camelCase");
    expect(result).toContain("JWT");
    expect(result).not.toContain("[naming-standard:v2]");
  });

  it("should handle text with no symbols", () => {
    expect(expandSymbols("plain text without symbols")).toBe("plain text without symbols");
  });

  it("should find symbols in text", () => {
    const found = findSymbols("Use [naming-standard:v2] and [unknown]");
    expect(found).toEqual(["[naming-standard:v2]"]);
  });

  it("should return empty array when no symbols found", () => {
    expect(findSymbols("no symbols")).toEqual([]);
  });

  it("should get a specific symbol entry", () => {
    const entry = getSymbol("[naming-standard:v2]");
    expect(entry).not.toBeNull();
    expect(entry!.category).toBe("naming");
    expect(entry!.version).toBe("v2");
  });

  it("should return null for unknown symbol", () => {
    expect(getSymbol("[fake]")).toBeNull();
  });

  it("should list all registered symbols", () => {
    const all = listSymbols();
    expect(all.length).toBeGreaterThanOrEqual(6);
    expect(all[0]).toHaveProperty("key");
    expect(all[0]).toHaveProperty("expansion");
  });

  it("should estimate token savings", () => {
    const savings = estimateSymbolSavings("Use [naming-standard:v2] and [security.auth:v3]");
    expect(savings.symbols_found).toBe(2);
    expect(savings.tokens_if_expanded).toBeGreaterThan(0);
    expect(savings.savings).toBeGreaterThan(0);
  });

  it("should estimate zero savings for text with no symbols", () => {
    const savings = estimateSymbolSavings("no symbols here");
    expect(savings.symbols_found).toBe(0);
    expect(savings.savings).toBe(0);
  });
});
