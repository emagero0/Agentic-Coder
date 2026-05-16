/**
 * runtime-adapter.test.ts — Unit tests for the Bun RuntimeAdapter implementation
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";

const TMP_DIR = path.join(process.cwd(), ".opencode", ".test-tmp-adapter");
const OUTPUTS_DIR = path.join(TMP_DIR, "outputs");

// Clean up before/after
function clean() { try { fs.rmSync(TMP_DIR, { recursive: true, force: true }); } catch { /* ok */ } }
beforeEach(() => clean());
afterEach(() => clean());

// Dynamic import after ensuring dirs exist
async function getAdapter() {
  fs.mkdirSync(TMP_DIR, { recursive: true });
  fs.mkdirSync(OUTPUTS_DIR, { recursive: true });
  const mod = await import("../../events/adapters/runtime/bun/index.js");
  return mod.createBunAdapter(OUTPUTS_DIR);
}

describe("Bun RuntimeAdapter", () => {
  it("should log messages", async () => {
    const adapter = await getAdapter();
    expect(() => adapter.log("test message")).not.toThrow();
  });

  it("should read and write JSON atomically", async () => {
    const adapter = await getAdapter();
    const testPath = path.join(TMP_DIR, "test.json");
    const data = { hello: "world", arr: [1, 2, 3] };
    await adapter.writeJSONAtomic(testPath, data);
    const result = await adapter.readJSON(testPath);
    expect(result).toEqual(data);
  });

  it("should snapshot files", async () => {
    const adapter = await getAdapter();
    const src = path.join(TMP_DIR, "source.json");
    const dest = path.join(TMP_DIR, "backup.json");
    const data = { version: "1.0" };
    await adapter.writeJSONAtomic(src, data);
    await adapter.snapshot(src, dest);
    const backup = await adapter.readJSON(dest);
    expect(backup).toEqual(data);
  });

  it("should append output reports", async () => {
    const adapter = await getAdapter();
    await adapter.appendOutput({ test: true, num: 42 }, "test-report.json");
    const files = fs.readdirSync(OUTPUTS_DIR);
    expect(files).toContain("test-report.json");
    const content = JSON.parse(fs.readFileSync(path.join(OUTPUTS_DIR, "test-report.json"), "utf-8"));
    expect(content.test).toBe(true);
  });

  it("should detect file existence", async () => {
    const adapter = await getAdapter();
    const p = path.join(TMP_DIR, "exists.txt");
    expect(adapter.fileExists(p)).toBe(false);
    adapter.writeTextFile(p, "content");
    expect(adapter.fileExists(p)).toBe(true);
  });

  it("should read and write text files", async () => {
    const adapter = await getAdapter();
    const p = path.join(TMP_DIR, "text.txt");
    adapter.writeTextFile(p, "hello world");
    expect(adapter.readTextFile(p)).toBe("hello world");
    expect(adapter.readTextFile("/nonexistent")).toBeNull();
  });

  it("should delete files", async () => {
    const adapter = await getAdapter();
    const p = path.join(TMP_DIR, "delete-me.txt");
    adapter.writeTextFile(p, "temp");
    expect(adapter.fileExists(p)).toBe(true);
    adapter.deleteFile(p);
    expect(adapter.fileExists(p)).toBe(false);
    // Should not throw on missing file
    expect(() => adapter.deleteFile("/nonexistent")).not.toThrow();
  });

  it("should ensure directories exist", async () => {
    const adapter = await getAdapter();
    const deepDir = path.join(TMP_DIR, "a", "b", "c");
    expect(fs.existsSync(deepDir)).toBe(false);
    adapter.ensureDirectory(deepDir);
    expect(fs.existsSync(deepDir)).toBe(true);
  });

  it("should hash strings", async () => {
    const mod = await import("../../events/adapters/runtime/bun/index.js");
    const adapter = mod.createBunAdapter(OUTPUTS_DIR);
    const hash1 = adapter.hashString("test data");
    const hash2 = adapter.hashString("test data");
    const hash3 = adapter.hashString("different");
    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(hash3);
    expect(hash1.length).toBeGreaterThan(0);
  });

  it("should throw readJSON on missing file", async () => {
    const adapter = await getAdapter();
    await expect(adapter.readJSON("/nonexistent.json")).rejects.toThrow();
  });
});
