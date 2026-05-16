/**
 * ecosystem-watch-source.test.ts — Unit tests for ecosystem watch handler (actual source)
 * Uses absolute paths since handler uses path.join(process.cwd(), ...)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as path from "path";
import { handleEcosystemWatch } from "../../events/handlers/deferred/ecosystem-watch.js";
import type { RuntimeAdapter } from "../../events/adapters/runtime/bun/index.js";

const ROOT = process.cwd();
const DEP_PATH = path.join(ROOT, ".opencode/state/inferred/dependencies/dependency-state.json");
const REG_PATH = path.join(ROOT, ".opencode/state/research/research-registry.json");
const OUT_DIR = path.join(ROOT, ".opencode/events/outputs");

function createAdapter(store: Map<string, string>): RuntimeAdapter {
  return {
    log: vi.fn(), readJSON: vi.fn(), writeJSONAtomic: vi.fn(), snapshot: vi.fn(),
    appendOutput: vi.fn(), runSync: vi.fn(), runAsync: vi.fn(), runDeferred: vi.fn(),
    fileExists: vi.fn(), readTextFile: vi.fn((p) => store.get(p) ?? null),
    writeTextFile: vi.fn((p, c) => store.set(p, c)), deleteFile: vi.fn(),
    ensureDirectory: vi.fn(), hashString: vi.fn(),
  };
}

describe("handleEcosystemWatch (source)", () => {
  let store: Map<string, string>;
  let adapter: RuntimeAdapter;
  beforeEach(() => { vi.clearAllMocks(); store = new Map(); adapter = createAdapter(store); });

  it("should detect stale dependencies", async () => {
    store.set(DEP_PATH, JSON.stringify({ dependencies: [{ name: "outdated-pkg", stale: true }] }));
    store.set(REG_PATH, JSON.stringify({ topics: [], ecosystem_watch: [] }));
    const result = await handleEcosystemWatch("session.idle", adapter);
    expect(result.stale_dependencies.count).toBe(1);
    expect(result.stale_dependencies.names).toContain("outdated-pkg");
    expect(result.action_required).toBe(true);
  });

  it("should detect dormant research topics", async () => {
    const old = new Date(Date.now() - 20 * 86400000).toISOString();
    store.set(DEP_PATH, JSON.stringify({ dependencies: [] }));
    store.set(REG_PATH, JSON.stringify({ topics: [{ id: "topic-1", status: "open", created_at: old }], ecosystem_watch: [] }));
    const result = await handleEcosystemWatch("session.idle", adapter);
    expect(result.dormant_topics.count).toBe(1);
  });

  it("should flag overdue weekly digest", async () => {
    const old = new Date(Date.now() - 30 * 86400000).toISOString();
    store.set(DEP_PATH, JSON.stringify({ dependencies: [] }));
    store.set(REG_PATH, JSON.stringify({ topics: [], ecosystem_watch: [{ generated_at: old }] }));
    const result = await handleEcosystemWatch("schedule.weekly", adapter);
    expect(result.recommended_actions).toContain("Weekly digest overdue — run /research summary");
  });

  it("should report no issues when healthy", async () => {
    const fresh = new Date().toISOString();
    store.set(DEP_PATH, JSON.stringify({ dependencies: [] }));
    store.set(REG_PATH, JSON.stringify({ topics: [], ecosystem_watch: [{ generated_at: fresh }] }));
    const result = await handleEcosystemWatch("schedule.weekly", adapter);
    expect(result.action_required).toBe(false);
  });

  it("should write output report", async () => {
    store.set(DEP_PATH, JSON.stringify({ dependencies: [] }));
    store.set(REG_PATH, JSON.stringify({ topics: [], ecosystem_watch: [] }));
    await handleEcosystemWatch("session.idle", adapter);
    expect(adapter.ensureDirectory).toHaveBeenCalledWith(OUT_DIR);
    expect(adapter.writeTextFile).toHaveBeenCalled();
  });
});
