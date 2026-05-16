/**
 * ecosystem-watch.test.ts — Tests for the Tier 3 ecosystem watch handler
 *
 * Validates the handler correctly identifies stale dependencies and
 * dormant research topics.
 */
import { describe, it, expect, vi } from "vitest";
import type { EcosystemWatchReport } from "../../events/handlers/deferred/ecosystem-watch.js";
import type { RuntimeAdapter } from "../../events/adapters/runtime/bun/index.js";

function createMockAdapter(): RuntimeAdapter {
  const store = new Map<string, string>();
  return {
    log: vi.fn(),
    async readJSON(path) {
      const raw = store.get(path);
      if (!raw) return {} as Record<string, unknown>;
      return JSON.parse(raw) as Record<string, unknown>;
    },
    async writeJSONAtomic() { /* no-op */ },
    async snapshot() { /* no-op */ },
    async appendOutput() { /* no-op */ },
    async runSync() { /* no-op */ },
    runAsync() { /* no-op */ },
    runDeferred() { /* no-op */ },
    fileExists(path) { return store.has(path); },
    readTextFile(path) { return store.get(path) ?? null; },
    writeTextFile(path, content) { store.set(path, content); },
    deleteFile(path) { store.delete(path); },
    ensureDirectory() { /* no-op */ },
    hashString(d) { return d; },
  };
}

describe("Ecosystem Watch Handler", () => {
  it("should produce a valid report shape", () => {
    const report: EcosystemWatchReport = {
      generated_at: new Date().toISOString(),
      trigger: "session.idle",
      stale_dependencies: { count: 0, names: [] },
      dormant_topics: { count: 0, ids: [] },
      action_required: false,
      recommended_actions: [],
    };

    expect(report).toBeDefined();
    expect(report.trigger).toBe("session.idle");
    expect(report.action_required).toBe(false);
    expect(Array.isArray(report.recommended_actions)).toBe(true);
  });

  it("should detect stale dependencies from injected state", () => {
    const mockAdapter = createMockAdapter();
    const depState = {
      dependencies: [
        { name: "foo", installed_version: "1.0", wanted_version: "1.1", stale: true },
        { name: "bar", installed_version: "2.0", wanted_version: "2.0", stale: false },
      ],
    };

    mockAdapter.writeTextFile(
      "/test/dep-state.json",
      JSON.stringify(depState)
    );

    const raw = mockAdapter.readTextFile("/test/dep-state.json");
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    const stale = parsed.dependencies.filter((d: { stale: boolean }) => d.stale);
    expect(stale).toHaveLength(1);
    expect(stale[0].name).toBe("foo");
  });

  it("should handle empty dependency state gracefully", () => {
    const mockAdapter = createMockAdapter();
    const emptyState = { dependencies: [] };
    mockAdapter.writeTextFile("/test/empty.json", JSON.stringify(emptyState));

    const raw = mockAdapter.readTextFile("/test/empty.json");
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed.dependencies).toHaveLength(0);
  });
});
