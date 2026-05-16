/**
 * weekly-audit.test.ts — Unit tests for the weekly audit handler
 *
 * Tests handleWeeklyAudit() directly from the source module.
 * Validates state reading, recommendation generation, and report output.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleWeeklyAudit } from "../../events/handlers/deferred/weekly-audit.js";
import type { RuntimeAdapter } from "../../events/adapters/runtime/bun/index.js";

function createMockAdapter(store?: Map<string, string>): RuntimeAdapter {
  const s = store ?? new Map<string, string>();
  return {
    log: vi.fn(),
    readJSON: vi.fn(async (path: string) => {
      const raw = s.get(path);
      if (!raw) throw new Error(`File not found: ${path}`);
      return JSON.parse(raw);
    }),
    writeJSONAtomic: vi.fn(),
    snapshot: vi.fn(),
    appendOutput: vi.fn().mockResolvedValue(undefined),
    runSync: vi.fn(),
    runAsync: vi.fn(),
    runDeferred: vi.fn(),
    fileExists: vi.fn(),
    readTextFile: vi.fn(),
    writeTextFile: vi.fn(),
    deleteFile: vi.fn(),
    ensureDirectory: vi.fn(),
    hashString: vi.fn(),
  };
}

describe("handleWeeklyAudit", () => {
  let adapter: RuntimeAdapter;
  let store: Map<string, string>;

  beforeEach(() => {
    vi.clearAllMocks();
    store = new Map();
    adapter = createMockAdapter(store);
  });

  it("should generate recommendations when features are unverified", async () => {
    store.set(
      ".opencode/state/inferred/features/feature-registry.json",
      JSON.stringify({ features: { "test-feature": { status: "detected" } } })
    );
    store.set(
      ".opencode/state/verified/features/feature-registry.json",
      JSON.stringify({ features: {} })
    );

    const event = {
      type: "schedule.weekly" as const,
      timestamp: new Date().toISOString(),
    };

    await handleWeeklyAudit(event, adapter);

    expect(adapter.appendOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        recommendations: expect.arrayContaining([
          expect.objectContaining({
            action: expect.stringContaining("/audit features"),
          }),
        ]),
      }),
      expect.any(String)
    );
  });

  it("should generate stale dependency recommendation", async () => {
    store.set(
      ".opencode/state/inferred/dependencies/dependency-state.json",
      JSON.stringify({ stale: true, dependencies: {} })
    );
    store.set(
      ".opencode/state/inferred/features/feature-registry.json",
      JSON.stringify({ features: {} })
    );
    store.set(
      ".opencode/state/verified/features/feature-registry.json",
      JSON.stringify({ features: {} })
    );

    const event = {
      type: "session.idle" as const,
      timestamp: new Date().toISOString(),
    };

    await handleWeeklyAudit(event, adapter);

    expect(adapter.appendOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        recommendations: expect.arrayContaining([
          expect.objectContaining({
            action: expect.stringContaining("/audit dependencies"),
          }),
        ]),
      }),
      expect.any(String)
    );
  });

  it("should generate recommendation when no architecture nodes tracked", async () => {
    store.set(
      ".opencode/state/inferred/architecture/architecture-graph.json",
      JSON.stringify({ nodes: [], edges: [] })
    );
    store.set(
      ".opencode/state/inferred/features/feature-registry.json",
      JSON.stringify({ features: {} })
    );
    store.set(
      ".opencode/state/verified/features/feature-registry.json",
      JSON.stringify({ features: {} })
    );

    const event = {
      type: "schedule.weekly" as const,
      timestamp: new Date().toISOString(),
    };

    await handleWeeklyAudit(event, adapter);

    expect(adapter.appendOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        recommendations: expect.arrayContaining([
          expect.objectContaining({
            action: expect.stringContaining("/scan-state"),
          }),
        ]),
      }),
      expect.any(String)
    );
  });

  it("should generate no recommendations when everything is healthy", async () => {
    store.set(
      ".opencode/state/inferred/features/feature-registry.json",
      JSON.stringify({ features: { f1: {} }, nodes: ["n1"] })
    );
    store.set(
      ".opencode/state/verified/features/feature-registry.json",
      JSON.stringify({ features: { f1: {} } })
    );
    store.set(
      ".opencode/state/inferred/architecture/architecture-graph.json",
      JSON.stringify({ nodes: [{ id: "n1" }], edges: [] })
    );
    store.set(
      ".opencode/state/inferred/dependencies/dependency-state.json",
      JSON.stringify({ stale: false, dependencies: {} })
    );

    const event = {
      type: "session.idle" as const,
      timestamp: new Date().toISOString(),
    };

    await handleWeeklyAudit(event, adapter);

    expect(adapter.appendOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        recommendations: [],
      }),
      expect.any(String)
    );
  });

  it("should handle missing state files gracefully (all null)", async () => {
    // Don't seed any store data — all readJSON calls will fail
    const event = {
      type: "schedule.weekly" as const,
      timestamp: new Date().toISOString(),
    };

    await expect(handleWeeklyAudit(event, adapter)).resolves.toBeUndefined();

    expect(adapter.appendOutput).toHaveBeenCalled();
  });

  it("should write report with correct filename for weekly schedule", async () => {
    store.set(
      ".opencode/state/inferred/features/feature-registry.json",
      JSON.stringify({ features: {} })
    );
    store.set(
      ".opencode/state/verified/features/feature-registry.json",
      JSON.stringify({ features: {} })
    );

    const event = {
      type: "schedule.weekly" as const,
      timestamp: "2026-05-12T00:00:00.000Z",
    };

    await handleWeeklyAudit(event, adapter);

    expect(adapter.appendOutput).toHaveBeenCalledWith(
      expect.any(Object),
      "weekly-audit-2026-05-12.json"
    );
  });
});
