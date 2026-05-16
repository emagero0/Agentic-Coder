/**
 * invalidate-cache.test.ts — Unit tests for cache invalidation handler
 * Uses absolute paths since handler uses path.join(process.cwd(), ...)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as path from "path";
import { handleInvalidateCache } from "../../events/handlers/sync/invalidate-cache.js";
import type { RuntimeAdapter } from "../../events/adapters/runtime/bun/index.js";

const ROOT = process.cwd();
const MANIFEST_PATH = path.join(ROOT, ".opencode/cache/invalidation/manifest.json");
const CTX_MANIFEST_PATH = path.join(ROOT, ".opencode/cache/manifest/context-manifest.json");

function createAdapter(store: Map<string, string>): RuntimeAdapter {
  return {
    log: vi.fn(), readJSON: vi.fn(), writeJSONAtomic: vi.fn(), snapshot: vi.fn(),
    appendOutput: vi.fn(), runSync: vi.fn(), runAsync: vi.fn(), runDeferred: vi.fn(),
    fileExists: vi.fn((p) => store.has(p)),
    readTextFile: vi.fn((p) => store.get(p) ?? null),
    writeTextFile: vi.fn((p, c) => store.set(p, c)),
    deleteFile: vi.fn((p) => store.delete(p)),
    ensureDirectory: vi.fn(),
    hashString: vi.fn((d) => `h:${d}`),
  };
}

describe("handleInvalidateCache", () => {
  let store: Map<string, string>;
  let adapter: RuntimeAdapter;
  beforeEach(() => { vi.clearAllMocks(); store = new Map(); adapter = createAdapter(store); });

  it("should evict a specific cache key", async () => {
    store.set(MANIFEST_PATH, JSON.stringify({ schema_version: "1", entries: { key1: { classification: "deterministic", type: "t", deps: [], dep_hashes: [], written_at: "", expires_at: "" } } }));
    const result = await handleInvalidateCache({ type: "cache.invalidate", cache_key: "key1" }, adapter);
    expect(result.evicted_keys).toEqual(["key1"]);
    expect(result.manifest_updated).toBe(true);
  });

  it("should return empty for unknown key", async () => {
    store.set(MANIFEST_PATH, JSON.stringify({ schema_version: "1", entries: {} }));
    const result = await handleInvalidateCache({ type: "cache.invalidate", cache_key: "unknown" }, adapter);
    expect(result.evicted_keys).toHaveLength(0);
  });

  it("should evict entries matching changed file path", async () => {
    store.set(MANIFEST_PATH, JSON.stringify({ schema_version: "1", entries: { e1: { classification: "inferred", type: "t", deps: ["src/file.ts"], dep_hashes: ["h"], written_at: "", expires_at: "" } } }));
    const result = await handleInvalidateCache({ type: "file.edited", path: "src/file.ts" }, adapter);
    expect(result.evicted_keys).toContain("e1");
  });

  it("should handle missing manifest", async () => {
    const result = await handleInvalidateCache({ type: "file.edited", path: "src/x.ts" }, adapter);
    expect(result.evicted_keys).toHaveLength(0);
    expect(result.changed_file).toBe("src/x.ts");
  });

  it("should handle event without path", async () => {
    const result = await handleInvalidateCache({ type: "session.completed" }, adapter);
    expect(result.changed_file).toBeNull();
  });

  it("should find affected agents from context manifest", async () => {
    // Handler needs invalidation manifest to exist (with entries) to proceed past early return
    store.set(MANIFEST_PATH, JSON.stringify({ schema_version: "1", entries: { "unrelated": { classification: "deterministic", type: "t", deps: ["other.ts"], dep_hashes: ["h"], written_at: "", expires_at: "" } } }));
    store.set(CTX_MANIFEST_PATH, JSON.stringify({ schema_version: "1", entries: { "src/agent.ts": { consumed_by: ["agent-1", "agent-2"] } } }));
    const result = await handleInvalidateCache({ type: "file.edited", path: "src/agent.ts" }, adapter);
    expect(result.affected_agents).toContain("agent-1");
    expect(result.affected_agents).toContain("agent-2");
  });
});
