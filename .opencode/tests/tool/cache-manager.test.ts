/** cache-manager.test.ts — Prompt cache manager with mocked fs */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFiles = new Map<string, string>();
vi.mock("fs", () => ({
  existsSync: vi.fn((p: string) => mockFiles.has(p)),
  readFileSync: vi.fn((p: string) => { const c = mockFiles.get(p); if (!c) throw new Error(); return c; }),
  writeFileSync: vi.fn((p: string, c: string) => mockFiles.set(p, c)),
  mkdirSync: vi.fn(), readdirSync: vi.fn(() => []), statSync: vi.fn(() => ({ mtimeMs: Date.now(), isFile: () => true, isDirectory: () => false })),
  unlinkSync: vi.fn((p: string) => mockFiles.delete(p)),
}));
vi.mock("crypto", () => ({
  createHash: vi.fn(() => {
    const h = { update: vi.fn(() => h), digest: vi.fn(() => "mh") }; return h;
  }),
}));

import { CacheManager } from "../../tool/prompt-compiler/cache-manager.js";

describe("CacheManager", () => {
  let cache: CacheManager;
  beforeEach(() => { vi.clearAllMocks(); mockFiles.clear(); cache = new CacheManager(); });

  it("should set and get a cached value", () => {
    cache.set("k1", "v1", { classification: "deterministic", dependencies: ["a.md"], source_hashes: ["h1"], invalidation_events: [], generator: "test" });
    const hit = cache.get<string>("k1", ["h1"]);
    expect(hit).not.toBeNull();
    expect(hit!.value).toBe("v1");
    expect(hit!.potentially_stale).toBe(false);
  });

  it("should report stale when dep hashes change", () => {
    cache.set("k2", "val", { classification: "inferred", dependencies: ["a.md"], source_hashes: ["h1"], invalidation_events: [], generator: "test" });
    const hit = cache.get<string>("k2", ["h2"]);
    expect(hit).not.toBeNull();
    expect(hit!.potentially_stale).toBe(true);
  });

  it("should return null for missing key", () => {
    expect(cache.get<string>("missing", [])).toBeNull();
  });

  it("should invalidate a specific key", () => {
    cache.set("k", "v", { classification: "deterministic", dependencies: [], source_hashes: [], invalidation_events: [], generator: "t" });
    cache.invalidateKey("k");
    expect(cache.get<string>("k", [])).toBeNull();
  });

  it("should invalidate by changed dependency", () => {
    cache.set("e1", "v1", { classification: "deterministic", dependencies: ["pkg.json"], source_hashes: ["h"], invalidation_events: [], generator: "t" });
    cache.set("e2", "v2", { classification: "inferred", dependencies: ["other.md"], source_hashes: ["h"], invalidation_events: [], generator: "t" });
    const evicted = cache.invalidateByDep("pkg.json");
    expect(evicted).toContain("e1");
    expect(evicted).not.toContain("e2");
  });

  it("should return stats", () => {
    cache.set("a", "1", { classification: "deterministic", dependencies: [], source_hashes: [], invalidation_events: [], generator: "t" });
    cache.set("b", "2", { classification: "inferred", dependencies: [], source_hashes: [], invalidation_events: [], generator: "t" });
    const stats = cache.stats();
    expect(stats.total_entries).toBe(2);
    expect(stats.by_classification.deterministic).toBe(1);
  });

  it("should prune expired entries", () => {
    cache.set("exp", "x", { classification: "deterministic", dependencies: [], source_hashes: [], invalidation_events: [], generator: "t", ttl_ms: -1000 });
    expect(cache.pruneExpired()).toBeGreaterThanOrEqual(1);
  });

  it("should clear all entries via invalidateKey on each", () => {
    cache.set("a", "1", { classification: "deterministic", dependencies: [], source_hashes: [], invalidation_events: [], generator: "t" });
    cache.set("b", "2", { classification: "inferred", dependencies: [], source_hashes: [], invalidation_events: [], generator: "t" });
    cache.invalidateKey("a");
    cache.invalidateKey("b");
    expect(cache.stats().total_entries).toBe(0);
  });
});
