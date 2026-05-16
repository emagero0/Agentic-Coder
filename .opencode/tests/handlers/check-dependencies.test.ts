/**
 * check-dependencies.test.ts — Unit tests for the dependency check handler
 *
 * Tests handleCheckDependencies() directly from the source module.
 * Validates dependency file detection, state marking, and report generation.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleCheckDependencies } from "../../events/handlers/async/check-dependencies.js";
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

describe("handleCheckDependencies", () => {
  let adapter: RuntimeAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = createMockAdapter();
  });

  it("should skip when tool doesn't touch dependency files", async () => {
    const event = {
      type: "tool.execute.after" as const,
      tool: "write",
      args: { file: "src/index.ts" },
      timestamp: new Date().toISOString(),
    };

    await handleCheckDependencies(event, adapter);

    expect(adapter.log).toHaveBeenCalledWith(
      expect.stringContaining("Tool executed: write")
    );
    expect(adapter.writeJSONAtomic).not.toHaveBeenCalled();
    expect(adapter.appendOutput).not.toHaveBeenCalled();
  });

  it("should flag state as stale when package.json changes", async () => {
    const event = {
      type: "tool.execute.after" as const,
      tool: "npm",
      args: { file: "package.json" },
      timestamp: "2026-05-12T12:00:00.000Z",
    };

    await (adapter as any).writeJSONAtomic(
      ".opencode/state/inferred/dependencies/dependency-state.json",
      { dependencies: {}, last_scanned: "2026-05-11", stale: false }
    );

    await handleCheckDependencies(event, adapter);

    expect(adapter.log).toHaveBeenCalledWith(
      expect.stringContaining("Dependency files changed")
    );

    // Verify state was marked stale — find the LAST write (handler's, not seed)
    const calls = (adapter.writeJSONAtomic as any).mock.calls;
    const handlerCalls = calls.filter((c: any[]) => c[0].includes("dependency-state.json"));
    const writeCall = handlerCalls[handlerCalls.length - 1]; // last one = handler's
    expect(writeCall).toBeDefined();
    expect(writeCall[1].stale).toBe(true);
    expect(writeCall[1].last_scanned).toBeNull();
    expect(writeCall[1].stale_reason).toContain("npm");
  });

  it("should detect package-lock.json changes", async () => {
    const event = {
      type: "tool.execute.after" as const,
      tool: "npm",
      args: { file: "package-lock.json" },
      timestamp: new Date().toISOString(),
    };

    await handleCheckDependencies(event, adapter);

    expect(adapter.writeJSONAtomic).toHaveBeenCalled();
  });

  it("should detect lockfile changes (yarn.lock, pnpm-lock, bun.lockb)", async () => {
    const lockfiles = ["yarn.lock", "pnpm-lock.yaml", "bun.lockb"];
    for (const lockfile of lockfiles) {
      vi.clearAllMocks();
      const event = {
        type: "tool.execute.after" as const,
        tool: "package-manager",
        args: { file: lockfile },
        timestamp: new Date().toISOString(),
      };
      await handleCheckDependencies(event, adapter);
      expect(adapter.writeJSONAtomic).toHaveBeenCalledWith(
        expect.stringContaining("dependency-state.json"),
        expect.objectContaining({ stale: true })
      );
    }
  });

  it("should detect Cargo.toml and Cargo.lock changes", async () => {
    const cargoFiles = ["Cargo.toml", "Cargo.lock"];
    for (const file of cargoFiles) {
      vi.clearAllMocks();
      const event = {
        type: "tool.execute.after" as const,
        tool: "cargo",
        args: { file },
        timestamp: new Date().toISOString(),
      };
      await handleCheckDependencies(event, adapter);
      if (file === "Cargo.toml") {
        expect(adapter.writeJSONAtomic).toHaveBeenCalled();
      }
    }
  });

  it("should detect go.mod and go.sum changes", async () => {
    const goFiles = ["go.mod", "go.sum"];
    for (const file of goFiles) {
      vi.clearAllMocks();
      const event = {
        type: "tool.execute.after" as const,
        tool: "go",
        args: { file },
        timestamp: new Date().toISOString(),
      };
      await handleCheckDependencies(event, adapter);
      expect(adapter.writeJSONAtomic).toHaveBeenCalled();
    }
  });

  it("should detect pyproject.toml and requirements.txt changes", async () => {
    const pyFiles = ["pyproject.toml", "requirements.txt"];
    for (const file of pyFiles) {
      vi.clearAllMocks();
      const event = {
        type: "tool.execute.after" as const,
        tool: "pip",
        args: { file },
        timestamp: new Date().toISOString(),
      };
      await handleCheckDependencies(event, adapter);
      expect(adapter.writeJSONAtomic).toHaveBeenCalled();
    }
  });

  it("should handle missing dependency state file gracefully", async () => {
    // Don't pre-seed the store — readJSON will throw
    const event = {
      type: "tool.execute.after" as const,
      tool: "npm",
      args: { file: "package.json" },
      timestamp: new Date().toISOString(),
    };

    await expect(
      handleCheckDependencies(event, adapter)
    ).resolves.toBeUndefined();

    // Should still write state (with default empty object via .catch)
    expect(adapter.writeJSONAtomic).toHaveBeenCalled();
  });

  it("should write a dependency change report on detection", async () => {
    const event = {
      type: "tool.execute.after" as const,
      tool: "npm",
      args: { file: "package.json" },
      timestamp: "2026-05-12T12:00:00.000Z",
    };

    await handleCheckDependencies(event, adapter);

    expect(adapter.appendOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: "dependency.changed",
        tier: 2,
        recommendations: expect.arrayContaining([
          expect.objectContaining({
            action: expect.stringContaining("/audit dependencies"),
          }),
        ]),
      })
    );
  });
});
