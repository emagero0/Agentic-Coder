/**
 * external-gateway.test.ts — Unit tests for External Intelligence Gateway
 * Mocks fs, crypto, and fetch to test provider config, caching, and HTTP.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as path from "path";

const ROOT = process.cwd();
const CACHE_DIR = path.join(ROOT, ".opencode/cache/external");
const mockFiles = new Map<string, string>();

vi.mock("fs", () => ({
  existsSync: vi.fn((p: string) => mockFiles.has(p)),
  readFileSync: vi.fn((p: string) => {
    const c = mockFiles.get(p);
    if (!c) throw new Error("ENOENT");
    return c;
  }),
  writeFileSync: vi.fn((p: string, c: string) => mockFiles.set(p, c)),
  mkdirSync: vi.fn(),
  readdirSync: vi.fn(() => []),
  statSync: vi.fn(() => ({ mtimeMs: Date.now(), isFile: () => true, isDirectory: () => false })),
}));

// Deterministic crypto hash — self-contained per instance (no shared state)
vi.mock("crypto", () => {
  const createHash = vi.fn(() => {
    let data = "";
    const h = {
      update: vi.fn((d: string) => { data += d; return h; }),
      digest: vi.fn(() => {
        let hash = 0;
        for (let i = 0; i < data.length; i++) hash = ((hash << 5) - hash) + data.charCodeAt(i);
        return `h${Math.abs(hash).toString(16)}`;
      }),
    };
    return h;
  });
  return { createHash };
});

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { ExternalGateway } from "../../tool/external-gateway/index.js";

describe("ExternalGateway", () => {
  let gateway: ExternalGateway;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFiles.clear();
    gateway = new ExternalGateway();
  });

  it("should throw for unknown providers", async () => {
    await expect(gateway.fetch("unknown", "/test")).rejects.toThrow("not whitelisted");
  });

  it("should return cached response when available and fresh", async () => {
    // Pre-populate the cache with a fresh entry via fetch
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ data: "original" }) });
    const first = await gateway.fetch("npm", "/cached-test");
    expect(first.cache_hit).toBe(false);

    // Second call should hit cache
    mockFetch.mockClear();
    const second = await gateway.fetch("npm", "/cached-test");
    expect(second.cache_hit).toBe(true);
    expect(second.data).toEqual({ data: "original" });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("should fetch from provider on cache miss", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ package: { name: "test-pkg", version: "1.0.0" } }),
    });
    const result = (await gateway.fetch("npm", "/test-pkg/latest")) as any;
    expect(mockFetch).toHaveBeenCalledWith(
      "https://registry.npmjs.org/test-pkg/latest",
      expect.objectContaining({ headers: expect.objectContaining({ "User-Agent": expect.any(String) }) })
    );
    expect(result.data).toBeDefined();
  });

  it("should handle fetch errors gracefully", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));
    await expect(gateway.fetch("npm", "/fail")).rejects.toThrow("Network error");
  });

  it("should throw on non-ok HTTP responses", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404, statusText: "Not Found" });
    await expect(gateway.fetch("npm", "/nonexistent")).rejects.toThrow("404");
  });

  it("should list all 6 providers", () => {
    const providers = gateway.listProviders();
    expect(providers).toHaveLength(6);
    const names = [...providers].sort();
    expect(names).toEqual(["caniuse", "github", "github-advisories", "npm", "osv.dev", "snyk"]);
  });

  it("should fetch npm packages via convenience method", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ name: "express", version: "5.0.0" }),
    });
    const result = await gateway.getNpmPackage("express");
    expect(result.cache_hit).toBe(false);
    expect((result as any).data.name).toBe("express");
  });

  it("should handle rate limiting — blocks after exhausting limit", async () => {
    // Clear cached responses so each request goes to rate limit check
    mockFiles.clear();
    let calls = 0;
    mockFetch.mockImplementation(async () => { calls++; return { ok: true, json: async () => ({}) }; });
    // Fire requests rapidly to exhaust the 60/min limit
    const reqs = Array.from({ length: 60 }, (_, i) =>
      gateway.fetch("npm", `/pkg-${i}`).catch(() => {})
    );
    await Promise.all(reqs);
    // Most but not necessarily all 60 should have reached fetch (some may be cached)
    expect(calls).toBeGreaterThan(50);
    // Next request within the same minute should be rate-limited
    await expect(gateway.fetch("npm", "/final")).rejects.toThrow("Rate limit");
  });
});
