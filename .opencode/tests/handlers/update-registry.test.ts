/**
 * update-registry.test.ts — Unit tests for the state registry update handler
 *
 * Tests handleRegistryUpdate() directly from the source module.
 * Covers snapshot creation, JSON read/write, merge logic, and audit logging.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleRegistryUpdate } from "../../events/handlers/sync/update-registry.js";
import type { RuntimeAdapter } from "../../events/adapters/runtime/bun/index.js";

function createMockAdapter(): RuntimeAdapter {
  const store = new Map<string, string>();
  return {
    log: vi.fn(),
    readJSON: vi.fn(async (path: string) => {
      const raw = store.get(path);
      if (!raw) throw new Error(`File not found: ${path}`);
      return JSON.parse(raw);
    }),
    writeJSONAtomic: vi.fn(async (path, data) => {
      store.set(path, JSON.stringify(data));
    }),
    snapshot: vi.fn(async (source, dest) => {
      const content = store.get(source);
      if (content) store.set(dest, content);
    }),
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

describe("handleRegistryUpdate", () => {
  let adapter: RuntimeAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = createMockAdapter();
  });

  it("should write to inferred registry without snapshot", async () => {
    const existingData = { features: { "test-feature": { status: "detected" } } };
    // Pre-seed the store so readJSON succeeds
    await (adapter as any).writeJSONAtomic(
      ".opencode/state/inferred/features/feature-registry.json",
      existingData
    );

    const event = {
      type: "state.registry.write" as const,
      target: "inferred" as const,
      registry: "features" as const,
      payload: { features: { "new-feature": { status: "detected" } } },
      timestamp: new Date().toISOString(),
    };

    await handleRegistryUpdate(event, adapter);

    expect(adapter.log).toHaveBeenCalledWith(
      expect.stringContaining("[update-registry] Writing to")
    );
    expect(adapter.snapshot).not.toHaveBeenCalled();
    expect(adapter.writeJSONAtomic).toHaveBeenCalled();
  });

  it("should create snapshot before writing to verified registry", async () => {
    const existingData = { features: {} };
    await (adapter as any).writeJSONAtomic(
      ".opencode/state/verified/features/feature-registry.json",
      existingData
    );

    const event = {
      type: "audit.promotion.confirmed" as const,
      target: "verified" as const,
      registry: "features" as const,
      payload: { features: { "promoted-feature": { status: "verified" } } },
      promotedBy: "user",
      timestamp: new Date().toISOString(),
    };

    await handleRegistryUpdate(event, adapter);

    expect(adapter.snapshot).toHaveBeenCalled();
    expect(adapter.log).toHaveBeenCalledWith(
      expect.stringContaining("Snapshot created")
    );
  });

  it("should merge payload with existing state (shallow top-level merge)", async () => {
    const existingData = { features: { existing: { status: "verified" } }, schema_version: "1.0" };
    await (adapter as any).writeJSONAtomic(
      ".opencode/state/inferred/features/feature-registry.json",
      existingData
    );

    const event = {
      type: "state.registry.write" as const,
      target: "inferred" as const,
      registry: "features" as const,
      payload: { features: { new: { status: "detected" } } },
      timestamp: new Date().toISOString(),
    };

    await handleRegistryUpdate(event, adapter);

    // Verify top-level merge: schema_version preserved, features replaced by payload
    const calls = (adapter.writeJSONAtomic as any).mock.calls;
    const handlerCall = calls[calls.length - 1];
    const writtenData = handlerCall[1];
    // Top-level keys from existing are preserved
    expect(writtenData.schema_version).toBe("1.0");
    // features key is replaced by payload (shallow merge)
    expect(writtenData.features.new).toBeDefined();
    expect(writtenData.features.new.status).toBe("detected");
  });

  it("should append audit output after write", async () => {
    await (adapter as any).writeJSONAtomic(
      ".opencode/state/inferred/dependencies/dependency-state.json",
      { dependencies: {} }
    );

    const event = {
      type: "state.registry.write" as const,
      target: "inferred" as const,
      registry: "dependencies" as const,
      payload: { dependencies: { "new-pkg": {} } },
      timestamp: "2026-05-12T12:00:00.000Z",
    };

    await handleRegistryUpdate(event, adapter);

    expect(adapter.appendOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: "state.registry.write",
        tier: 1,
        trigger: "Registry write: inferred/dependencies",
      })
    );
  });

  it("should handle architecture registry writes", async () => {
    const event = {
      type: "state.registry.write" as const,
      target: "inferred" as const,
      registry: "architecture" as const,
      payload: { nodes: [], edges: [] },
      timestamp: new Date().toISOString(),
    };

    await (adapter as any).writeJSONAtomic(
      ".opencode/state/inferred/architecture/architecture-graph.json",
      { nodes: [], edges: [] }
    );

    await expect(handleRegistryUpdate(event, adapter)).resolves.toBeUndefined();
  });

  it("should use correct file paths for all registry types", async () => {
    const registries = ["features", "architecture", "dependencies"] as const;
    for (const registry of registries) {
      const path = `.opencode/state/inferred/${registry}/${registry === "features" ? "feature-registry.json" : registry === "architecture" ? "architecture-graph.json" : "dependency-state.json"}`;
      await (adapter as any).writeJSONAtomic(path, {});
    }
    // All should resolve without error
    for (const registry of registries) {
      const event = {
        type: "state.registry.write" as const,
        target: "inferred" as const,
        registry,
        payload: {},
        timestamp: new Date().toISOString(),
      };
      await expect(handleRegistryUpdate(event, adapter)).resolves.toBeUndefined();
    }
  });
});
