/**
 * fingerprint-engine.ts — Context Fingerprint Engine
 *
 * Generates stable, deterministic SHA-256 fingerprints for files, markdown
 * sections, JSON registries, and dependency trees.
 *
 * Design constraints:
 *   - mtime-first optimization: SHA-256 is only computed on modification
 *   - Read-only: never writes to source files
 *   - No external dependencies beyond Node.js built-ins
 *   - Fingerprints are stable: same content always produces same hash
 *
 * Hash types produced:
 *   file_hash        — Detect any file change (SHA-256 of full content)
 *   section_hashes   — Per-chunk SHA-256, keyed by stable chunk ID
 *   dependency_hash  — Composite hash of multiple file hashes
 *   template_hash    — Hash of static instruction segments (prompt compiler)
 */

import * as fs from "fs";
import * as crypto from "crypto";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface FileFingerprint {
  path: string;
  mtime_ms: number;
  file_hash: string;
  sections: Record<string, string>;  // chunk_id → sha256
  dependency_hash: string | null;    // set when this file is part of a dep tree
}

export interface SectionFingerprintMap {
  [chunkId: string]: string;  // chunk_id → sha256
}

export interface RegistryFingerprint {
  keys_hashed: string[];
  composite_hash: string;
}

// ── Mtime Cache (in-process, not persisted) ───────────────────────────────────

// Stores last-known mtime + hash to skip re-hashing unchanged files
const mtimeCache = new Map<string, { mtime_ms: number; hash: string }>();

// ── Hash Helpers ──────────────────────────────────────────────────────────────

function sha256(content: string): string {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

function compositeHash(hashes: string[]): string {
  return sha256(hashes.sort().join("|"));
}

// ── Chunk ID Extraction ───────────────────────────────────────────────────────

/**
 * Extracts stable chunk IDs from markdown content.
 * Priority 1: explicit <!-- chunk:id=some.id --> comment after heading.
 * Priority 2: generated from filename stem + slugified heading text.
 */
function extractChunkId(
  fileStem: string,
  headingText: string,
  contentAfterHeading: string
): string {
  // Check for explicit chunk:id comment (first 3 lines after heading)
  const lines = contentAfterHeading.split("\n").slice(0, 3);
  for (const line of lines) {
    const match = line.match(/<!--\s*chunk:id=([a-zA-Z0-9._-]+)\s*-->/);
    if (match) return match[1];
  }
  // Fallback: generated ID
  const slug = headingText
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${fileStem}.${slug}`;
}

/**
 * Split markdown into sections at H1 and H2 boundaries.
 * Returns an array of { chunkId, heading, content } tuples.
 */
function splitMarkdownIntoSections(
  fileStem: string,
  fullContent: string
): Array<{ chunkId: string; heading: string; content: string }> {
  const lines = fullContent.split("\n");
  const sections: Array<{ chunkId: string; heading: string; content: string }> = [];
  let current: { heading: string; lines: string[] } | null = null;

  for (const line of lines) {
    const h1 = line.match(/^# (.+)/);
    const h2 = line.match(/^## (.+)/);
    const headingText = h1?.[1] ?? h2?.[1] ?? null;

    if (headingText) {
      if (current) {
        const content = current.lines.join("\n");
        const chunkId = extractChunkId(fileStem, current.heading, content);
        sections.push({ chunkId, heading: current.heading, content });
      }
      current = { heading: headingText, lines: [] };
    } else if (current) {
      current.lines.push(line);
    }
  }

  // Flush last section
  if (current && current.lines.length > 0) {
    const content = current.lines.join("\n");
    const chunkId = extractChunkId(fileStem, current.heading, content);
    sections.push({ chunkId, heading: current.heading, content });
  }

  return sections;
}

// ── Fingerprint Engine ────────────────────────────────────────────────────────

export class FingerprintEngine {
  /**
   * Fingerprint a file.
   * Uses mtime as a fast-path: if mtime matches last-known value, returns cached hash.
   * Only recomputes SHA-256 when the file has actually changed.
   */
  fingerprintFile(filePath: string): FileFingerprint {
    if (!fs.existsSync(filePath)) {
      throw new Error(`[FingerprintEngine] File not found: ${filePath}`);
    }

    const stat = fs.statSync(filePath);
    const mtime_ms = stat.mtimeMs;
    const cached = mtimeCache.get(filePath);

    let file_hash: string;
    if (cached && cached.mtime_ms === mtime_ms) {
      // Fast path: mtime unchanged, reuse hash
      file_hash = cached.hash;
    } else {
      // Slow path: compute SHA-256
      const content = fs.readFileSync(filePath, "utf-8");
      file_hash = sha256(content);
      mtimeCache.set(filePath, { mtime_ms, hash: file_hash });
    }

    // Compute per-section hashes (only for markdown files)
    const sections: Record<string, string> = {};
    if (filePath.endsWith(".md")) {
      const content = fs.readFileSync(filePath, "utf-8");
      const stem = filePath.replace(/\\/g, "/").split("/").pop()?.replace(/\.md$/, "") ?? "file";
      const sectionList = splitMarkdownIntoSections(stem, content);
      for (const sec of sectionList) {
        sections[sec.chunkId] = sha256(sec.content);
      }
    }

    return {
      path: filePath,
      mtime_ms,
      file_hash,
      sections,
      dependency_hash: null,
    };
  }

  /**
   * Fingerprint all sections of a markdown file.
   * Returns a map of { chunkId → sha256 }.
   */
  fingerprintSections(filePath: string): SectionFingerprintMap {
    const fp = this.fingerprintFile(filePath);
    return fp.sections;
  }

  /**
   * Fingerprint specific keys of a JSON registry object.
   * Hashes only the requested keys, not the entire object.
   */
  fingerprintRegistry(
    obj: Record<string, unknown>,
    keys: string[]
  ): RegistryFingerprint {
    const keyHashes = keys.map((k) => sha256(JSON.stringify(obj[k] ?? null)));
    return {
      keys_hashed: keys,
      composite_hash: compositeHash(keyHashes),
    };
  }

  /**
   * Compute a composite dependency hash across multiple files.
   * Useful as a single invalidation key for a context bundle.
   */
  fingerprintDependencyTree(filePaths: string[]): string {
    const hashes = filePaths.map((p) => {
      try {
        return this.fingerprintFile(p).file_hash;
      } catch {
        return sha256(`missing:${p}`);
      }
    });
    return compositeHash(hashes);
  }

  /**
   * Check if a file has changed since the given previous fingerprint.
   * Uses mtime as fast-path before comparing hashes.
   */
  hasChanged(filePath: string, previous: FileFingerprint): boolean {
    if (!fs.existsSync(filePath)) return true;  // file deleted = changed
    const stat = fs.statSync(filePath);
    if (stat.mtimeMs === previous.mtime_ms) return false;  // mtime unchanged
    const current = this.fingerprintFile(filePath);
    return current.file_hash !== previous.file_hash;
  }

  /**
   * Hash static template text (e.g., supervisor instruction blocks).
   * Used by the prompt compiler to detect instruction-level changes.
   */
  hashTemplate(templateContent: string): string {
    return sha256(templateContent);
  }

  /**
   * Evict a file from the in-process mtime cache.
   * Called after external processes modify a file.
   */
  evictMtimeCache(filePath: string): void {
    mtimeCache.delete(filePath);
  }

  /**
   * Clear the entire in-process mtime cache.
   */
  clearMtimeCache(): void {
    mtimeCache.clear();
  }
}
