/** fingerprint-engine.test.ts — Context fingerprint engine with mocked fs/crypto */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFiles = new Map<string, string>();
vi.mock("fs", () => ({
  existsSync: vi.fn((p: string) => mockFiles.has(p)),
  readFileSync: vi.fn((p: string) => { const c = mockFiles.get(p); if (!c) throw new Error(); return c; }),
  statSync: vi.fn((p: string) => {
    if (!mockFiles.has(p)) throw new Error();
    return { mtimeMs: 1000, isFile: () => true, isDirectory: () => false };
  }),
}));

vi.mock("crypto", () => ({
  createHash: vi.fn(() => {
    let n = 0;
    const h = { update: vi.fn(() => h), digest: vi.fn(() => `fh${n++}`) };
    return h;
  }),
}));

import { FingerprintEngine } from "../../tool/context-resolver/fingerprint-engine.js";

describe("FingerprintEngine", () => {
  let engine: FingerprintEngine;
  beforeEach(() => { vi.clearAllMocks(); mockFiles.clear(); engine = new FingerprintEngine(); });

  it("should fingerprint a file", () => {
    mockFiles.set("test.md", "# Test\nContent");
    const fp = engine.fingerprintFile("test.md");
    expect(fp.path).toBe("test.md");
    expect(fp.file_hash).toBeTruthy();
  });

  it("should throw for missing file", () => {
    expect(() => engine.fingerprintFile("/missing.md")).toThrow();
  });

  it("should return cached fingerprint on same mtime", () => {
    mockFiles.set("s.md", "# Same");
    const fp1 = engine.fingerprintFile("s.md");
    const fp2 = engine.fingerprintFile("s.md");
    expect(fp2.file_hash).toBe(fp1.file_hash);
  });

  it("should evict mtime cache", () => {
    mockFiles.set("f.md", "# V1");
    engine.fingerprintFile("f.md");
    engine.evictMtimeCache("f.md");
    mockFiles.set("f.md", "# V2");
    expect(engine.fingerprintFile("f.md").file_hash).toBeTruthy();
  });

  it("should clear mtime cache", () => {
    mockFiles.set("a.md", "# A");
    engine.fingerprintFile("a.md");
    engine.clearMtimeCache();
    expect(engine.fingerprintFile("a.md").file_hash).toBeTruthy();
  });

  it("should compute dependency tree fingerprint", () => {
    mockFiles.set("a.md", "# A");
    mockFiles.set("b.md", "# B");
    const hash = engine.fingerprintDependencyTree(["a.md", "b.md"]);
    expect(typeof hash).toBe("string");
    expect(hash.length).toBeGreaterThan(0);
  });

  it("should compute dependency hash deterministically", () => {
    mockFiles.set("x.md", "# X");
    const h1 = engine.fingerprintDependencyTree(["x.md"]);
    const h2 = engine.fingerprintDependencyTree(["x.md"]);
    expect(h1).toBe(h2);
  });

  it("should handle empty file list", () => {
    expect(typeof engine.fingerprintDependencyTree([])).toBe("string");
  });
});
