/** chunk-loader.test.ts — Markdown chunk loader with mocked fs */
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as path from "path";

const mockFiles = new Map<string, string>();
vi.mock("fs", () => ({
  existsSync: vi.fn((p: string) => mockFiles.has(p)),
  readFileSync: vi.fn((p: string) => { const c = mockFiles.get(p); if (!c) throw new Error(); return c; }),
  statSync: vi.fn(() => ({ mtimeMs: Date.now(), mtime: new Date(), isFile: () => true, isDirectory: () => false })),
}));
vi.mock("crypto", () => ({
  createHash: vi.fn(() => {
    const h = { update: vi.fn(() => h), digest: vi.fn(() => "ch") };
    return h;
  }),
}));

import { ChunkLoader } from "../../tool/context-resolver/chunk-loader.js";
const resolve = (p: string) => path.resolve(p.replace(/\//g, "\\"));

describe("ChunkLoader", () => {
  let loader: ChunkLoader;
  beforeEach(() => { vi.clearAllMocks(); mockFiles.clear(); loader = new ChunkLoader(); });

  it("should split markdown into chunks at H2 headings", () => {
    mockFiles.set(resolve("/test.md"), "# Title\n\n## Section 1\nContent A\n\n## Section 2\nContent B");
    const chunks = loader.loadChunks("/test.md");
    expect(chunks.length).toBeGreaterThanOrEqual(2);
  });

  it("should generate stable chunk IDs from headings", () => {
    mockFiles.set(resolve("/stable.md"), "# Doc\n\n## My Section\nContent");
    const chunks = loader.loadChunks("/stable.md");
    const section = chunks.find(c => c.chunk_id.includes("my-section"));
    expect(section).toBeDefined();
  });

  it("should include H1 sections as chunks", () => {
    mockFiles.set(resolve("/one.md"), "# Main Heading\n\n## Sub\nSub content");
    const chunks = loader.loadChunks("/one.md");
    expect(chunks.length).toBeGreaterThanOrEqual(2);
  });

  it("should return cached chunks on second call", () => {
    mockFiles.set(resolve("/cached.md"), "# Cached\n\n## S1\nContent");
    const first = loader.loadChunks("/cached.md");
    const second = loader.loadChunks("/cached.md");
    expect(second).toEqual(first);
  });

  it("should evict file from cache", () => {
    mockFiles.set(resolve("/evict.md"), "# Evict\n\n## S1\nv1");
    loader.loadChunks("/evict.md");
    loader.evictFile(path.resolve("/evict.md"));
    mockFiles.set(resolve("/evict.md"), "# Evict\n\n## S1\nv2");
    const chunks = loader.loadChunks("/evict.md");
    expect(chunks.length).toBeGreaterThanOrEqual(1);
  });

  it("should clear entire cache", () => {
    mockFiles.set(resolve("/a.md"), "# A\n\n## S1\nc");
    loader.loadChunks("/a.md");
    loader.clearCache();
    const chunks = loader.loadChunks("/a.md");
    expect(chunks.length).toBeGreaterThanOrEqual(1);
  });

  it("should get specific chunks by IDs", () => {
    mockFiles.set(resolve("/filter.md"), "# Filter\n\n## Keep\nData\n\n## Skip\nData");
    const all = loader.loadChunks("/filter.md");
    const keepId = all.find(c => c.heading === "Keep")?.chunk_id;
    expect(keepId).toBeDefined();
    if (keepId) {
      const filtered = loader.getChunksByIds("/filter.md", [keepId]);
      expect(filtered.length).toBe(1);
      expect(filtered[0].heading).toBe("Keep");
    }
  });

  it("should extract explicit chunk IDs from comments", () => {
    mockFiles.set(resolve("/explicit.md"), "# Doc\n\n## Named\n<!-- chunk:id=custom.sec -->\nContent");
    const chunks = loader.loadChunks("/explicit.md");
    expect(chunks.some(c => c.explicit_id === "custom.sec")).toBe(true);
  });

  it("should track char offset for each chunk", () => {
    mockFiles.set(resolve("/offset.md"), "# A\n\n## B\nContent");
    const chunks = loader.loadChunks("/offset.md");
    expect(chunks[0].char_offset).toBe(0);
  });

  it("should hash each chunk", () => {
    mockFiles.set(resolve("/hash.md"), "# H\n\n## S\nData");
    const chunks = loader.loadChunks("/hash.md");
    chunks.forEach(c => expect(c.hash).toBeTruthy());
  });
});
