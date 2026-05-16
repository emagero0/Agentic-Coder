/**
 * context-resolver.test.ts — Unit tests for ContextResolver
 * Mocks fs to avoid real file I/O.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFiles = new Map<string, string>();
const mockDirContents = new Map<string, string[]>();

vi.mock("fs", () => ({
  existsSync: vi.fn((p: string) => mockFiles.has(p)),
  readFileSync: vi.fn((p: string, _enc?: string) => {
    const c = mockFiles.get(p);
    if (!c) throw new Error(`ENOENT: ${p}`);
    return c;
  }),
  readdirSync: vi.fn((p: string) => mockDirContents.get(p) ?? []),
  statSync: vi.fn((p: string) => ({ mtimeMs: 1000, isFile: () => true, isDirectory: () => false })),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  rmSync: vi.fn(),
}));

import { ContextResolver } from "../../tool/context-resolver/index.js";

describe("ContextResolver", () => {
  beforeEach(() => {
    mockFiles.clear();
    mockDirContents.clear();
  });

  it("should build bundle for an agent", async () => {
    const resolver = new ContextResolver();
    const mdPath = ".opencode/context/agents/test-agent.md";
    mockFiles.set(mdPath, "# Test Agent\nSome content");
    mockDirContents.set(".opencode/context/project-intelligence", []);

    // resolveDeps will try to find agent files
    const result = await resolver.resolve("test-agent");
    expect(result.consumer).toBe("test-agent");
    expect(typeof result.dependency_hash).toBe("string");
  });

  it("should resolve commands", async () => {
    const resolver = new ContextResolver();
    const cmdPath = ".opencode/command/test-cmd.md";
    mockFiles.set(cmdPath, "# Test Command\ncontent");
    mockDirContents.set(".opencode/command", ["test-cmd.md"]);

    const result = await resolver.resolveCommand("/test-cmd");
    expect(result.consumer).toBe("/test-cmd");
  });

  it("should resolve policies for task types", () => {
    const resolver = new ContextResolver();
    const policies = resolver.resolvePoliciesForTask("code-review");
    expect(Array.isArray(policies)).toBe(true);
  });

  it("should handle detail levels (summary, symbolic)", async () => {
    const resolver = new ContextResolver();
    const mdPath = ".opencode/context/agents/summary-test.md";
    const content = `---
id: summary-test
---
## Section 1
Content 1
## Section 2
Content 2`;
    mockFiles.set(mdPath, content);
    mockDirContents.set(".opencode/context/project-intelligence", []);

    const full = await resolver.resolve("summary-test", "full");
    expect(typeof full.dependency_hash).toBe("string");

    const summary = await resolver.resolve("summary-test", "summary");
    expect(typeof summary.dependency_hash).toBe("string");

    const symbolic = await resolver.resolve("summary-test", "symbolic");
    expect(typeof symbolic.dependency_hash).toBe("string");
  });

  it("should track missing files", async () => {
    const resolver = new ContextResolver();
    mockDirContents.set(".opencode/context/project-intelligence", []);
    const result = await resolver.resolve("non-existent-agent");
    expect(result.missing_files).toBeDefined();
  });

  it("should invalidate cache for changed file", () => {
    const resolver = new ContextResolver();
    const result = resolver.invalidate("/path/to/changed/file.ts");
    expect(result.evicted_files).toHaveLength(1);
    expect(Array.isArray(result.affected_agents)).toBe(true);
  });

  it("should invalidate all caches", () => {
    const resolver = new ContextResolver();
    expect(() => resolver.invalidateAll()).not.toThrow();
  });

  it("should build context manifest", async () => {
    const resolver = new ContextResolver();
    mockFiles.set(".opencode/context/core/standards/test.md", "# Test");
    mockDirContents.set(".opencode/context/core/standards", ["test.md"]);
    mockDirContents.set(".opencode/context", ["core"]);
    mockDirContents.set(".opencode/context/core", ["standards"]);
    await expect(resolver.buildContextManifest()).resolves.toBeUndefined();
  });
});
