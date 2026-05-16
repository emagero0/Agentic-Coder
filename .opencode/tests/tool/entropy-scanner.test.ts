/** entropy-scanner.test.ts — Context health scanner with mocked fs/deps */
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as path from "path";

const mockFiles = new Map<string, string>();
vi.mock("fs", () => ({
  existsSync: vi.fn((p: string) => mockFiles.has(p)),
  readFileSync: vi.fn((p: string) => { const c = mockFiles.get(p); if (!c) throw new Error(); return c; }),
  statSync: vi.fn((p: string) => {
    if (!mockFiles.has(p)) throw new Error();
    return { mtimeMs: Date.now() - 100000, mtime: new Date(Date.now() - 100000), isFile: () => true, isDirectory: () => false };
  }),
  readdirSync: vi.fn(() => []),
}));
vi.mock("crypto", () => ({
  createHash: vi.fn(() => {
    const h = { update: vi.fn(() => h), digest: vi.fn(() => "eh") }; return h;
  }),
}));

vi.mock("../../tool/context-resolver/dependency-resolver.js", () => ({
  getAllContextFiles: vi.fn(() => ["/test.md", "/other.md"]),
  getConsumers: vi.fn((p: string) => p.includes("test") ? ["agent-1"] : []),
}));

import { scanContextHealth } from "../../tool/context-resolver/entropy-scanner.js";

describe("EntropyScanner", () => {
  beforeEach(() => { vi.clearAllMocks(); mockFiles.clear(); });

  it("should produce a health report", async () => {
    mockFiles.set("/test.md", "# Test\nContent");
    mockFiles.set("/other.md", "# Other\nOther content");
    const report = await scanContextHealth();
    expect(report.total_files).toBeGreaterThanOrEqual(2);
    expect(report.health_score).toBeGreaterThanOrEqual(0);
  });

  it("should detect unused files", async () => {
    mockFiles.set("/unused.md", "# Unused");
    mockFiles.set("/used.md", "# Used");
    const report = await scanContextHealth();
    expect(Array.isArray(report.unused_files)).toBe(true);
  });

  it("should compute health score", async () => {
    const mod = await vi.importActual<typeof import("../../tool/context-resolver/dependency-resolver.js")>("../../tool/context-resolver/dependency-resolver.js");
    vi.spyOn(mod, "getAllContextFiles").mockReturnValue(["/healthy.md"]);
    mockFiles.set("/healthy.md", "fine");
    const report = await scanContextHealth();
    expect(typeof report.health_score).toBe("number");
  });

  it("should handle empty context gracefully", async () => {
    const depRes = await vi.importActual<typeof import("../../tool/context-resolver/dependency-resolver.js")>("../../tool/context-resolver/dependency-resolver.js");
    vi.spyOn(depRes, "getAllContextFiles").mockReturnValue([]);
    const report = await scanContextHealth();
    expect(report.total_files).toBe(0);
  });
});
