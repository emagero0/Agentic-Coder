/** template-engine.test.ts — Prompt template engine with mocked fs/crypto */
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as path from "path";

const mockFiles = new Map<string, string>();
vi.mock("fs", () => ({
  existsSync: vi.fn((p: string) => mockFiles.has(p)),
  readFileSync: vi.fn((p: string) => { const c = mockFiles.get(p); if (!c) throw new Error(); return c; }),
  writeFileSync: vi.fn(), mkdirSync: vi.fn(), readdirSync: vi.fn(() => []), statSync: vi.fn(() => ({ mtimeMs: Date.now(), isFile: () => true, isDirectory: () => false })),
}));

let hashCounter = 0;
vi.mock("crypto", () => ({
  createHash: vi.fn(() => {
    const h = { update: vi.fn(() => h), digest: vi.fn(() => `h${hashCounter++}`) };
    return h;
  }),
}));

import { TemplateEngine } from "../../tool/prompt-compiler/template-engine.js";

describe("TemplateEngine", () => {
  let engine: TemplateEngine;
  beforeEach(() => { vi.clearAllMocks(); mockFiles.clear(); hashCounter = 0; engine = new TemplateEngine(); });

  it("should compile a template from markdown file", () => {
    mockFiles.set("/path/to/agent.md", "# Test Agent\n\n## Instructions\nDo X\n\n## Standards\nFollow Y");
    const result = engine.buildSupervisorBundle("test-agent", "/path/to/agent.md", { variables: {}, sources: [] }, { maxContextChars: 5000 });
    expect(result.content).toContain("Test Agent");
    expect(result.dep_paths).toContain("/path/to/agent.md");
    expect(result.effective_classification).toBe("deterministic");
  });

  it("should inject state variables into prompt", () => {
    mockFiles.set("/agent.md", "# Agent\nHello {{NAME}}, your role is {{ROLE}}.");
    const result = engine.buildSupervisorBundle("agent", "/agent.md", { variables: { NAME: "Alice", ROLE: "reviewer" }, sources: [] }, { maxContextChars: 5000 });
    expect(result.content).toContain("Hello Alice");
    expect(result.content).toContain("your role is reviewer");
  });

  it("should handle missing state variables (leave placeholder)", () => {
    mockFiles.set("/a.md", "# A\nHello {{NAME}}.");
    const result = engine.buildSupervisorBundle("a", "/a.md", { variables: {}, sources: [] }, { maxContextChars: 5000 });
    expect(result.content).toContain("{{NAME}}");
  });

  it("should truncate content exceeding maxContextChars", () => {
    const long = "# A\n" + "x".repeat(10000);
    mockFiles.set("/long.md", long);
    const result = engine.buildSupervisorBundle("a", "/long.md", { variables: {}, sources: [] }, { maxContextChars: 100 });
    expect(result.content.length).toBeLessThan(500);
  });

  it("should classify as inferred when state has inferred sources", () => {
    mockFiles.set("/agent.md", "# Agent\nFixed content");
    const result = engine.buildSupervisorBundle("agent", "/agent.md", { variables: { x: "y" }, sources: [{ path: "state.json", hash: "h", classification: "inferred" }] }, { maxContextChars: 5000 });
    expect(result.effective_classification).toBe("inferred");
  });

  it("should classify as speculative when state has speculative sources", () => {
    mockFiles.set("/agent.md", "# Agent\nContent");
    const result = engine.buildSupervisorBundle("agent", "/agent.md", { variables: {}, sources: [{ path: "exp.json", hash: "h", classification: "speculative" }] }, { maxContextChars: 5000 });
    expect(result.effective_classification).toBe("speculative");
  });

  it("should include heading placeholders in result", () => {
    mockFiles.set("/agent.md", "# Agent\n\n## Section 1\nContent\n\n## Section 2\nMore");
    const result = engine.buildSupervisorBundle("agent", "/agent.md", { variables: {}, sources: [] }, { maxContextChars: 5000 });
    expect(result.content).toContain("## Section 1");
    expect(result.content).toContain("## Section 2");
  });

  it("should compile template with graph data in context", () => {
    mockFiles.set("/sup.md", "# Supervisor\nGraph: {{GRAPH_SUMMARY}}\nStats: {{GRAPH_STATS}}");
    const result = engine.buildSupervisorBundle("sup", "/sup.md", { variables: { GRAPH_SUMMARY: "5 nodes, 6 edges", GRAPH_STATS: "3 verified" }, sources: [] }, { maxContextChars: 5000 });
    expect(result.content).toContain("5 nodes, 6 edges");
    expect(result.content).toContain("3 verified");
  });
});
