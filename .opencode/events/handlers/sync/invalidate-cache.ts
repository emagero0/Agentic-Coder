/**
 * invalidate-cache.ts — Tier 1 Synchronous Cache Invalidation Handler
 *
 * Fires on: file.edited, file.watcher.updated, cache.invalidate
 *
 * Purpose: When a source file changes, evict all cache entries that declared
 * a dependency on that file. Uses the invalidation manifest + context manifest
 * to perform surgical, dependency-aware eviction — never global invalidation.
 *
 * Tier 1 (synchronous): runs before any analysis handlers so that subsequent
 * Tier 2 analyze-drift events operate with a clean cache.
 *
 * Design constraints:
 *   - Never touches verified/ state — only cache/ directories
 *   - Selective invalidation only — no global wipes
 *   - Non-blocking on missing files (logs warning, continues)
 *   - Idempotent: safe to call multiple times for the same file
 */

import * as path from "path";
import type { RuntimeAdapter } from "../../adapters/runtime/bun/index.js";

// ── Types ──────────────────────────────────────────────────────────────────────

interface InvalidationEvent {
  type: string;
  path?: string;
  file?: string;
  cache_key?: string;
}

export interface InvalidationReport {
  triggered_by: string;
  changed_file: string | null;
  evicted_keys: string[];
  affected_agents: string[];
  manifest_updated: boolean;
  timestamp: string;
}

// ── Manifest Types ─────────────────────────────────────────────────────────────

type CacheClassification = "deterministic" | "inferred" | "speculative";

interface ManifestEntry {
  classification: CacheClassification;
  type: string;
  deps: string[];
  dep_hashes: string[];
  written_at: string;
  expires_at: string;
}

interface InvalidationManifest {
  schema_version: string;
  entries: Record<string, ManifestEntry>;
}

interface ContextManifest {
  schema_version: string;
  entries: Record<string, { consumed_by?: string[]; chunks?: string[] }>;
}

// ── Paths ──────────────────────────────────────────────────────────────────────

const ROOT = process.cwd();
const CACHE_ROOT = path.join(ROOT, ".opencode/cache");
const MANIFEST_PATH = path.join(CACHE_ROOT, "invalidation/manifest.json");
const CONTEXT_MANIFEST_PATH = path.join(CACHE_ROOT, "manifest/context-manifest.json");

const CLASSIFICATION_DIRS: Record<CacheClassification, string> = {
  deterministic: path.join(CACHE_ROOT, "deterministic"),
  inferred:      path.join(CACHE_ROOT, "inferred"),
  speculative:   path.join(CACHE_ROOT, "speculative"),
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function cacheFilePath(classification: CacheClassification, key: string, adapter: RuntimeAdapter): string {
  const hashed = adapter.hashString(key);
  return path.join(CLASSIFICATION_DIRS[classification], `${hashed}.json`);
}

function readJson<T>(filePath: string, adapter: RuntimeAdapter): T | null {
  const content = adapter.readTextFile(filePath);
  if (!content) return null;
  try { return JSON.parse(content) as T; } catch { return null; }
}

function writeJson(filePath: string, data: unknown, adapter: RuntimeAdapter): void {
  adapter.writeTextFile(filePath, JSON.stringify(data, null, 2));
}

function normalizeFilePath(raw: string): string {
  return raw.replace(/\\/g, "/");
}

function pathsMatch(dep: string, changed: string): boolean {
  const d = normalizeFilePath(dep);
  const c = normalizeFilePath(changed);
  return d === c || c.endsWith(d) || d.endsWith(c);
}

// ── Affected Agent Lookup ──────────────────────────────────────────────────────

function getAffectedAgents(changedFile: string, adapter: RuntimeAdapter): string[] {
  const ctxManifest = readJson<ContextManifest>(CONTEXT_MANIFEST_PATH, adapter);
  if (!ctxManifest?.entries) return [];

  const consumers = new Set<string>();
  const normalized = normalizeFilePath(changedFile);

  for (const [entryPath, entry] of Object.entries(ctxManifest.entries)) {
    if (pathsMatch(entryPath, normalized)) {
      for (const consumer of entry.consumed_by ?? []) {
        consumers.add(consumer);
      }
    }
  }

  return [...consumers];
}

// ── Main Handler ──────────────────────────────────────────────────────────────

export async function handleInvalidateCache(
  event: InvalidationEvent,
  adapter: RuntimeAdapter
): Promise<InvalidationReport> {
  const timestamp = new Date().toISOString();

  const changedFile = event.path ?? event.file ?? null;

  const report: InvalidationReport = {
    triggered_by: event.type,
    changed_file: changedFile,
    evicted_keys: [],
    affected_agents: [],
    manifest_updated: false,
    timestamp,
  };

  // ── Handle specific cache key invalidation ──────────────────────────────────
  if (event.type === "cache.invalidate" && event.cache_key) {
    const manifest = readJson<InvalidationManifest>(MANIFEST_PATH, adapter);
    if (manifest?.entries[event.cache_key]) {
      const entry = manifest.entries[event.cache_key];
      const fp = cacheFilePath(entry.classification, event.cache_key, adapter);
      adapter.deleteFile(fp);
      delete manifest.entries[event.cache_key];
      writeJson(MANIFEST_PATH, manifest, adapter);
      report.evicted_keys = [event.cache_key];
      report.manifest_updated = true;
    }
    return report;
  }

  // ── Handle file change events ───────────────────────────────────────────────
  if (!changedFile) return report;

  const manifest = readJson<InvalidationManifest>(MANIFEST_PATH, adapter);
  if (!manifest?.entries) return report;

  const evicted: string[] = [];

  for (const [key, entry] of Object.entries(manifest.entries)) {
    const deps = entry.deps ?? [];
    if (deps.some((dep) => pathsMatch(dep, changedFile))) {
      const fp = cacheFilePath(entry.classification, key, adapter);
      adapter.deleteFile(fp);
      delete manifest.entries[key];
      evicted.push(key);
    }
  }

  if (evicted.length > 0) {
    writeJson(MANIFEST_PATH, manifest, adapter);
    report.manifest_updated = true;
  }

  report.evicted_keys = evicted;
  report.affected_agents = getAffectedAgents(changedFile, adapter);

  // Write invalidation report to outputs for observability
  const outputPath = path.join(ROOT, ".opencode/events/outputs", `invalidation-${Date.now()}.json`);
  adapter.ensureDirectory(path.dirname(outputPath));
  writeJson(outputPath, report, adapter);

  return report;
}
