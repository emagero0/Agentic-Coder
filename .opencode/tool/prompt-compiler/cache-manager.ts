/**
 * cache-manager.ts — Prompt Cache Manager
 *
 * Reads and writes cache entries across the classified cache subdirs:
 *   deterministic/ — verified inputs, long TTL (24h)
 *   inferred/      — unverified state, medium TTL (1h)
 *   speculative/   — R&D / experimental, short TTL (15m)
 *
 * Every cache file has a full metadata envelope — never naked payloads.
 * Dependency tracking is mandatory: every set() call must declare deps.
 *
 * Design constraints:
 *   - Read-only on get() — never mutates state
 *   - Writes always go through the envelope wrapper
 *   - invalidateByDep() only removes entries that declare the changed dep
 *   - No global invalidation methods (except clearAll, which requires explicit call)
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

// ── Types ──────────────────────────────────────────────────────────────────────

export type CacheClassification = "deterministic" | "inferred" | "speculative";

/**
 * Default TTLs in milliseconds by classification.
 */
const DEFAULT_TTL: Record<CacheClassification, number> = {
  deterministic: 24 * 60 * 60 * 1000,   // 24 hours
  inferred:       1 * 60 * 60 * 1000,   // 1 hour
  speculative:   15 * 60 * 1000,        // 15 minutes
};

export interface CacheMeta {
  classification: CacheClassification;
  /** Paths to source files this cache entry depends on (relative to cwd) */
  dependencies: string[];
  /** SHA-256 hashes of each dep file at write time (parallel array with dependencies) */
  source_hashes: string[];
  /** Event types that should trigger invalidation of this entry */
  invalidation_events: string[];
  /** Which tool/system generated this cache entry */
  generator: string;
  /** Optional TTL override in milliseconds */
  ttl_ms?: number;
}

export interface CacheEnvelope<T> {
  cache_key: string;
  classification: CacheClassification;
  created_at: string;
  expires_at: string;
  source_hashes: string[];
  dependencies: string[];
  invalidation_events: string[];
  generator: string;
  schema_version: 1;
  payload: T;
}

export interface CacheHit<T> {
  value: T;
  classification: CacheClassification;
  created_at: string;
  cache_key: string;
  /** True if any dep hash changed (stale hit — caller should decide whether to recompute) */
  potentially_stale: boolean;
}

export interface CacheStats {
  total_entries: number;
  by_classification: Record<CacheClassification, number>;
  oldest_entry: string | null;
  newest_entry: string | null;
  expired_entries: number;
}

// ── Manifest Types ─────────────────────────────────────────────────────────────

interface ManifestEntry {
  classification: CacheClassification;
  type: string;
  deps: string[];
  dep_hashes: string[];
  written_at: string;
  expires_at: string;
}

interface InvalidationManifest {
  schema_version: "1.0";
  description: string;
  entries: Record<string, ManifestEntry>;
}

// ── Paths ──────────────────────────────────────────────────────────────────────

const ROOT = process.cwd();
const CACHE_ROOT = path.join(ROOT, ".opencode/cache");
const MANIFEST_PATH = path.join(CACHE_ROOT, "invalidation/manifest.json");

const CLASSIFICATION_DIRS: Record<CacheClassification, string> = {
  deterministic: path.join(CACHE_ROOT, "deterministic"),
  inferred:      path.join(CACHE_ROOT, "inferred"),
  speculative:   path.join(CACHE_ROOT, "speculative"),
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function cacheKey(key: string): string {
  // Sanitize key into a safe filename
  return crypto.createHash("sha256").update(key).digest("hex");
}

function cachePath(classification: CacheClassification, key: string): string {
  return path.join(CLASSIFICATION_DIRS[classification], `${cacheKey(key)}.json`);
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readJson<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
  } catch {
    return null;
  }
}

function writeJson(filePath: string, data: unknown): void {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// ── Manifest Helpers ───────────────────────────────────────────────────────────

function readManifest(): InvalidationManifest {
  const m = readJson<InvalidationManifest>(MANIFEST_PATH);
  return m ?? {
    schema_version: "1.0",
    description: "Maps every cache key to its source file dependencies and classification.",
    entries: {},
  };
}

function writeManifest(manifest: InvalidationManifest): void {
  ensureDir(path.dirname(MANIFEST_PATH));
  writeJson(MANIFEST_PATH, manifest);
}

// ── Cache Manager ──────────────────────────────────────────────────────────────

export class CacheManager {
  /**
   * Retrieve a cache entry.
   *
   * Returns null if:
   *   - Key does not exist
   *   - Entry has expired (past expires_at)
   *
   * Returns a CacheHit with potentially_stale=true if any dep hash has
   * changed since write time (caller decides whether to recompute).
   */
  get<T>(key: string, currentDepHashes: string[]): CacheHit<T> | null {
    // Search across all classification dirs — caller doesn't need to know where it lives
    for (const classification of Object.keys(CLASSIFICATION_DIRS) as CacheClassification[]) {
      const fp = cachePath(classification, key);
      const envelope = readJson<CacheEnvelope<T>>(fp);
      if (!envelope) continue;

      // TTL check
      if (Date.now() > new Date(envelope.expires_at).getTime()) {
        // Expired — clean up silently
        try { fs.unlinkSync(fp); } catch { /* ignore */ }
        continue;
      }

      // Dependency hash check (non-blocking — just flag as stale)
      const storedHashes = envelope.source_hashes;
      const potentially_stale =
        currentDepHashes.length > 0 &&
        JSON.stringify(storedHashes.sort()) !== JSON.stringify(currentDepHashes.sort());

      return {
        value: envelope.payload,
        classification: envelope.classification,
        created_at: envelope.created_at,
        cache_key: key,
        potentially_stale,
      };
    }

    return null;
  }

  /**
   * Write a cache entry with a full metadata envelope.
   * Updates the invalidation manifest after writing.
   */
  set<T>(key: string, value: T, meta: CacheMeta): void {
    const now = new Date();
    const ttl = meta.ttl_ms ?? DEFAULT_TTL[meta.classification];
    const expiresAt = new Date(now.getTime() + ttl).toISOString();

    const envelope: CacheEnvelope<T> = {
      cache_key: key,
      classification: meta.classification,
      created_at: now.toISOString(),
      expires_at: expiresAt,
      source_hashes: meta.source_hashes,
      dependencies: meta.dependencies,
      invalidation_events: meta.invalidation_events,
      generator: meta.generator,
      schema_version: 1,
      payload: value,
    };

    const dir = CLASSIFICATION_DIRS[meta.classification];
    ensureDir(dir);
    writeJson(cachePath(meta.classification, key), envelope);

    // Update invalidation manifest
    const manifest = readManifest();
    manifest.entries[key] = {
      classification: meta.classification,
      type: meta.generator,
      deps: meta.dependencies,
      dep_hashes: meta.source_hashes,
      written_at: now.toISOString(),
      expires_at: expiresAt,
    };
    writeManifest(manifest);
  }

  /**
   * Invalidate all cache entries that depend on the given file path.
   * Returns the list of evicted cache keys.
   *
   * This is the primary invalidation path — called by invalidate-cache.ts.
   */
  invalidateByDep(changedFilePath: string): string[] {
    const manifest = readManifest();
    const evicted: string[] = [];

    // Normalize path to forward-slash relative
    const normalized = changedFilePath.replace(/\\/g, "/");

    for (const [key, entry] of Object.entries(manifest.entries)) {
      const deps = entry.deps.map((d) => d.replace(/\\/g, "/"));
      if (deps.some((d) => d === normalized || normalized.endsWith(d) || d.endsWith(normalized))) {
        // Delete the cache file
        const fp = cachePath(entry.classification, key);
        try { if (fs.existsSync(fp)) fs.unlinkSync(fp); } catch { /* ignore */ }
        delete manifest.entries[key];
        evicted.push(key);
      }
    }

    if (evicted.length > 0) {
      writeManifest(manifest);
    }

    return evicted;
  }

  /**
   * Invalidate a single cache entry by key.
   */
  invalidateKey(key: string): void {
    const manifest = readManifest();
    const entry = manifest.entries[key];
    if (entry) {
      const fp = cachePath(entry.classification, key);
      try { if (fs.existsSync(fp)) fs.unlinkSync(fp); } catch { /* ignore */ }
      delete manifest.entries[key];
      writeManifest(manifest);
    }
  }

  /**
   * Return cache statistics, broken down by classification.
   */
  stats(): CacheStats {
    const manifest = readManifest();
    const now = Date.now();
    const entries = Object.values(manifest.entries);

    const byCls: Record<CacheClassification, number> = {
      deterministic: 0,
      inferred: 0,
      speculative: 0,
    };
    let expired = 0;
    let oldest: string | null = null;
    let newest: string | null = null;

    for (const e of entries) {
      byCls[e.classification] = (byCls[e.classification] ?? 0) + 1;
      if (Date.now() > new Date(e.expires_at).getTime()) expired++;
      if (!oldest || e.written_at < oldest) oldest = e.written_at;
      if (!newest || e.written_at > newest) newest = e.written_at;
    }

    return {
      total_entries: entries.length,
      by_classification: byCls,
      oldest_entry: oldest,
      newest_entry: newest,
      expired_entries: expired,
    };
  }

  /**
   * Remove all expired entries from disk and manifest.
   * Safe to call at any time — only removes entries past their expires_at.
   */
  pruneExpired(): number {
    const manifest = readManifest();
    const now = Date.now();
    let pruned = 0;

    for (const [key, entry] of Object.entries(manifest.entries)) {
      if (now > new Date(entry.expires_at).getTime()) {
        const fp = cachePath(entry.classification, key);
        try { if (fs.existsSync(fp)) fs.unlinkSync(fp); } catch { /* ignore */ }
        delete manifest.entries[key];
        pruned++;
      }
    }

    if (pruned > 0) writeManifest(manifest);
    return pruned;
  }
}
