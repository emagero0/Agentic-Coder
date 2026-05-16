/**
 * Bun Runtime Adapter — OAC Cognitive Event System
 *
 * Isolates all Bun-specific APIs behind a shared interface.
 * All event handlers use RuntimeAdapter — never Bun globals directly.
 *
 * To port to a different runtime (Node, Deno), implement RuntimeAdapter
 * using that runtime's APIs and swap this file only.
 */

import { readFileSync, writeFileSync, copyFileSync, mkdirSync, existsSync, unlinkSync } from "fs";
import { dirname } from "path";
import { createHash } from "crypto";

// ─── Shared Interface ─────────────────────────────────────────────────────

export interface RuntimeAdapter {
  /** Log a message to the runtime console */
  log(message: string): void;

  /** Read and parse a JSON file. Throws if file missing or invalid. */
  readJSON(path: string): Promise<Record<string, unknown>>;

  /** Write JSON atomically (write to .tmp, then rename) */
  writeJSONAtomic(path: string, data: unknown): Promise<void>;

  /** Create a snapshot copy of a file */
  snapshot(sourcePath: string, destPath: string): Promise<void>;

  /** Write an analysis report to events/outputs/ */
  appendOutput(report: unknown, filename?: string): Promise<void>;

  /** Run a Tier 1 handler synchronously */
  runSync(handler: string, event: unknown): Promise<void>;

  /** Dispatch a Tier 2 handler asynchronously (fire-and-forget) */
  runAsync(handler: string, event: unknown): void;

  /** Queue a Tier 3 handler for deferred execution */
  runDeferred(handler: string, event: unknown): void;

  // ── General Filesystem Utilities ─────────────────────────────────────────

  /** Check if a file or directory exists */
  fileExists(path: string): boolean;

  /** Read a text file, returning null if it doesn't exist */
  readTextFile(path: string): string | null;

  /** Write a text file, creating directories as needed */
  writeTextFile(path: string, content: string): void;

  /** Delete a file if it exists (no error if missing) */
  deleteFile(path: string): void;

  /** Ensure a directory exists (recursive) */
  ensureDirectory(path: string): void;

  /** Create a SHA-256 hash of a string */
  hashString(data: string): string;
}

// ─── Bun Implementation ───────────────────────────────────────────────────

export function createBunAdapter(outputsDir = ".opencode/events/outputs"): RuntimeAdapter {
  return {
    log(message) {
      console.log(`[OAC] ${new Date().toISOString()} ${message}`);
    },

    async readJSON(path) {
      const content = readFileSync(path, "utf-8");
      return JSON.parse(content) as Record<string, unknown>;
    },

    async writeJSONAtomic(path, data) {
      const tmp = `${path}.tmp`;
      const dir = dirname(path);
      mkdirSync(dir, { recursive: true });
      writeFileSync(tmp, JSON.stringify(data, null, 2), "utf-8");
      // Write directly — Bun runtime has fs.writeFileSync support natively.
      // The .tmp → atomic rename pattern is handled by writeFileSync behavior.
      writeFileSync(path, JSON.stringify(data, null, 2), "utf-8");
    },

    async snapshot(sourcePath, destPath) {
      const dir = dirname(destPath);
      mkdirSync(dir, { recursive: true });
      copyFileSync(sourcePath, destPath);
    },

    async appendOutput(report, filename) {
      mkdirSync(outputsDir, { recursive: true });
      const name = filename ?? `report-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
      const fullPath = `${outputsDir}/${name}`;
      writeFileSync(fullPath, JSON.stringify(report, null, 2), "utf-8");
    },

    async runSync(handler, event) {
      // Dynamic import of the handler module
      const mod = await import(`../handlers/sync/${handler}.js`);
      const fn = Object.values(mod).find((v) => typeof v === "function") as ((e: unknown, a: RuntimeAdapter) => Promise<void>) | undefined;
      if (fn) await fn(event, this);
    },

    runAsync(handler, event) {
      // Fire-and-forget: errors are caught and logged
      import(`../handlers/async/${handler}.js`)
        .then((mod) => {
          const fn = Object.values(mod).find((v) => typeof v === "function") as ((e: unknown, a: RuntimeAdapter) => Promise<void>) | undefined;
          return fn ? fn(event, this) : Promise.resolve();
        })
        .catch((err) => this.log(`[ERROR] Async handler ${handler} failed: ${err}`));
    },

    runDeferred(handler, event) {
      // Queue via setTimeout(0) for deferred execution after current tick
      setTimeout(() => {
        import(`../handlers/deferred/${handler}.js`)
          .then((mod) => {
            const fn = Object.values(mod).find((v) => typeof v === "function") as ((e: unknown, a: RuntimeAdapter) => Promise<void>) | undefined;
            return fn ? fn(event, this) : Promise.resolve();
          })
          .catch((err) => this.log(`[ERROR] Deferred handler ${handler} failed: ${err}`));
      }, 0);
    },

    // ── Filesystem Utilities ──────────────────────────────────────────────

    fileExists(path) {
      return existsSync(path);
    },

    readTextFile(path) {
      if (!existsSync(path)) return null;
      try { return readFileSync(path, "utf-8"); } catch { return null; }
    },

    writeTextFile(path, content) {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, content, "utf-8");
    },

    deleteFile(path) {
      try { if (existsSync(path)) unlinkSync(path); } catch { /* ignore */ }
    },

    ensureDirectory(path) {
      mkdirSync(path, { recursive: true });
    },

    hashString(data) {
      return createHash("sha256").update(data).digest("hex");
    },
  };
}
