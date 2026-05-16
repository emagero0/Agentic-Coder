/**
 * prompt-compiler.test.ts — Unit tests for PromptCompiler
 * Mocks sub-modules to test facade logic with inline factories.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCacheGet = vi.fn();
const mockCacheSet = vi.fn();
const mockBuild = vi.fn();
const mockInvalidateKey = vi.fn();
const mockInvalidateByDep = vi.fn(() => ["k1", "k2"]);
const mockStatsFn = vi.fn(() => ({ size: 5, hits: 10, misses: 3 }));
const mockPrune = vi.fn(() => 2);

vi.mock("../../tool/prompt-compiler/cache-manager.js", () => ({
  CacheManager: class {
    get = mockCacheGet;
    set = mockCacheSet;
    invalidateKey = mockInvalidateKey;
    invalidateByDep = mockInvalidateByDep;
    stats = mockStatsFn;
    pruneExpired = mockPrune;
  },
}));

vi.mock("../../tool/prompt-compiler/template-engine.js", () => ({
  TemplateEngine: class {
    buildSupervisorBundle = mockBuild;
  },
}));

vi.mock("../../tool/prompt-compiler/symbol-registry.js", () => ({
  expandSymbols: (s: string) => s,
}));

import { PromptCompiler } from "../../tool/prompt-compiler/index.js";
import type { ResolvedContextBundle } from "../../tool/context-resolver/index.js";

const mockBundle: ResolvedContextBundle = {
  consumer: "test-agent",
  deps: { context_files: ["a.md", "b.md"], registry_files: ["c.json"], chunk_filters: {}, policy_files: [], capabilities: [], agent_files: [], instruction_files: [] },
  fingerprints: { "a.md": { file_hash: "hash-a", file_path: "a.md", mtime_ms: 1000, size_bytes: 100 }, "b.md": { file_hash: "hash-b", file_path: "b.md", mtime_ms: 1001, size_bytes: 200 } },
  dependency_hash: "dep-hash-123",
  chunks: {},
  missing_files: [],
};

describe("PromptCompiler", () => {
  let compiler: PromptCompiler;

  beforeEach(() => {
    vi.clearAllMocks();
    compiler = new PromptCompiler();
    mockBuild.mockReturnValue({
      content: "Fresh prompt",
      effective_classification: "deterministic",
      dep_paths: ["a.md"],
      dep_hashes: ["hash-a"],
      content_hash: "ch-456",
    });
  });

  it("should return cached on hit", async () => {
    mockCacheGet.mockReturnValue({ value: "Cached!", potentially_stale: false, classification: "deterministic" });
    const r = await compiler.compile("agent", "/p.md", mockBundle);
    expect(r.cache_hit).toBe(true);
    expect(r.content).toBe("Cached!");
    expect(mockBuild).not.toHaveBeenCalled();
  });

  it("should compile fresh on miss", async () => {
    mockCacheGet.mockReturnValue(null);
    const r = await compiler.compile("agent", "/p.md", mockBundle);
    expect(r.cache_hit).toBe(false);
    expect(mockBuild).toHaveBeenCalled();
    expect(mockCacheSet).toHaveBeenCalled();
  });

  it("should recompile on stale cache", async () => {
    mockCacheGet.mockReturnValue({ value: "Stale", potentially_stale: true, classification: "inferred" });
    const r = await compiler.compile("agent", "/p.md", mockBundle);
    expect(r.cache_hit).toBe(false);
    expect(mockBuild).toHaveBeenCalled();
  });

  it("should check cache validity", () => {
    mockCacheGet.mockReturnValue({ value: "c", potentially_stale: false, classification: "deterministic" });
    expect(compiler.isCacheValid("agent", mockBundle)).toBe(true);
    mockCacheGet.mockReturnValue(null);
    expect(compiler.isCacheValid("agent", mockBundle)).toBe(false);
  });

  it("should invalidate agent cache", () => {
    compiler.invalidate("agent", "dep-hash");
    expect(mockInvalidateKey).toHaveBeenCalledWith("agent:prompt:dep-hash");
  });

  it("should invalidate by file", () => {
    expect(compiler.invalidateByFile("pkg.json")).toEqual(["k1", "k2"]);
    expect(mockInvalidateByDep).toHaveBeenCalledWith("pkg.json");
  });

  it("should return stats and prune", () => {
    expect(compiler.stats().size).toBe(5);
    expect(compiler.pruneExpired()).toBe(2);
  });
});
