/**
 * analyze-drift.test.ts — Unit tests for the drift analysis handler
 *
 * Tests handleAnalyzeDrift() directly from the source module.
 * Validates drift signal detection, architecture sensitivity, and report generation.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleAnalyzeDrift } from "../../events/handlers/async/analyze-drift.js";
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
    writeJSONAtomic: vi.fn(async (path, data) => { s.set(path, JSON.stringify(data)); }),
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

describe("handleAnalyzeDrift", () => {
  let adapter: RuntimeAdapter;
  let store: Map<string, string>;

  beforeEach(() => {
    vi.clearAllMocks();
    store = new Map();
    adapter = createMockAdapter(store);
  });

  it("should log when no architecture graph exists", async () => {
    const event = {
      type: "file.edited" as const,
      path: "src/index.ts",
      timestamp: new Date().toISOString(),
    };

    await handleAnalyzeDrift(event, adapter);

    expect(adapter.log).toHaveBeenCalledWith(
      expect.stringContaining("No architecture graph found")
    );
    expect(adapter.appendOutput).not.toHaveBeenCalled();
  });

  it("should detect new file in architecture-sensitive path", async () => {
    // Pre-seed architecture graph
    const graph = { nodes: [{ id: "existing-module", path: "src/existing.ts" }], edges: [] };
    store.set(
      ".opencode/state/inferred/architecture/architecture-graph.json",
      JSON.stringify(graph)
    );

    const event = {
      type: "file.watcher.updated" as const,
      path: "src/services/new-api.ts",
      timestamp: new Date().toISOString(),
    };

    await handleAnalyzeDrift(event, adapter);

    expect(adapter.appendOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        analysis: expect.objectContaining({
          impact: "medium",
        }),
      })
    );
  });

  it("should detect unknown source file not in graph", async () => {
    const graph = {
      nodes: [{ id: "existing", path: "src/known.ts" }],
      edges: [],
    };
    store.set(
      ".opencode/state/inferred/architecture/architecture-graph.json",
      JSON.stringify(graph)
    );

    const event = {
      type: "file.edited" as const,
      path: "src/unknown.ts",
      timestamp: new Date().toISOString(),
    };

    await handleAnalyzeDrift(event, adapter);

    expect(adapter.appendOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        recommendations: expect.arrayContaining([
          expect.objectContaining({
            action: expect.stringContaining("Unknown source file"),
          }),
        ]),
      })
    );
  });

  it("should not flag known source files as drift", async () => {
    const graph = {
      nodes: [
        { id: "existing", path: "src/known.ts" },
        { id: "another", path: "src/another.ts" },
      ],
      edges: [],
    };
    store.set(
      ".opencode/state/inferred/architecture/architecture-graph.json",
      JSON.stringify(graph)
    );

    const event = {
      type: "file.edited" as const,
      path: "src/known.ts",
      timestamp: new Date().toISOString(),
    };

    await handleAnalyzeDrift(event, adapter);

    expect(adapter.appendOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        analysis: expect.objectContaining({
          impact: "none",
        }),
      })
    );
  });

  it("should detect api/ route files as architecture-sensitive", async () => {
    const graph = { nodes: [], edges: [] };
    store.set(
      ".opencode/state/inferred/architecture/architecture-graph.json",
      JSON.stringify(graph)
    );

    const sensitivePaths = [
      "src/api/users.ts",
      "src/routes/auth.ts",
      "app/controller.ts",
      "pages/index.tsx",
      "src/services/payments.ts",
      "src/middleware/auth.ts",
      "src/db/migrations/001.ts",
      "jest.config.ts",
    ];

    for (const path of sensitivePaths) {
      vi.clearAllMocks();
      store.set(
        ".opencode/state/inferred/architecture/architecture-graph.json",
        JSON.stringify(graph)
      );

      const event = {
        type: "file.watcher.updated" as const,
        path,
        timestamp: new Date().toISOString(),
      };

      await handleAnalyzeDrift(event, adapter);
      expect(adapter.appendOutput).toHaveBeenCalled();
    }
  });

  it("should handle session.completed events without path", async () => {
    const graph = { nodes: [], edges: [] };
    store.set(
      ".opencode/state/inferred/architecture/architecture-graph.json",
      JSON.stringify(graph)
    );

    const event = {
      type: "session.completed" as const,
      timestamp: new Date().toISOString(),
    };

    await handleAnalyzeDrift(event, adapter);

    expect(adapter.appendOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        analysis: expect.objectContaining({ impact: "none" }),
      })
    );
  });

  it("should not flag non-source files as drift", async () => {
    const graph = {
      nodes: [{ id: "existing", path: "src/existing.ts" }],
      edges: [],
    };
    store.set(
      ".opencode/state/inferred/architecture/architecture-graph.json",
      JSON.stringify(graph)
    );

    const event = {
      type: "file.edited" as const,
      path: "README.md",
      timestamp: new Date().toISOString(),
    };

    await handleAnalyzeDrift(event, adapter);

    // Should not flag README.md as unknown source file
    expect(adapter.appendOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        analysis: expect.objectContaining({ impact: "none" }),
      })
    );
  });

  it("should write a drift analysis report", async () => {
    const graph = { nodes: [{ id: "mod", path: "src/api/route.ts" }], edges: [] };
    store.set(
      ".opencode/state/inferred/architecture/architecture-graph.json",
      JSON.stringify(graph)
    );

    const event = {
      type: "file.watcher.updated" as const,
      path: "src/services/new.ts",
      timestamp: "2026-05-12T12:00:00.000Z",
    };

    await handleAnalyzeDrift(event, adapter);

    expect(adapter.appendOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: "drift.analysis",
        tier: 2,
      })
    );
  });
});
