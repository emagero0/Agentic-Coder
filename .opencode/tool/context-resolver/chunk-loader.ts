/**
 * chunk-loader.ts — Semantic Markdown Chunk Loader
 *
 * Splits markdown files into semantic sections at H1/H2 heading boundaries.
 * Supports stable chunk IDs so cache keys survive heading renames.
 *
 * Stable ID resolution priority:
 *   1. Explicit: <!-- chunk:id=section.name --> comment after heading
 *   2. Generated: {filename-stem}.{slugified-heading}
 *
 * Design constraints:
 *   - H1/H2 granularity only (H3+ is future work per design review)
 *   - Read-only: never writes to source files
 *   - No external dependencies beyond Node.js built-ins
 *   - Chunks include full content between boundaries (inclusive of heading line)
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface MarkdownChunk {
  /** Stable identifier — survives heading renames */
  chunk_id: string;
  /** Display name from heading text */
  heading: string;
  /** 1 for H1, 2 for H2 */
  heading_level: 1 | 2;
  /** Full text content of this section (includes heading line) */
  content: string;
  /** SHA-256 of content */
  hash: string;
  /** Source file path */
  file: string;
  /** Byte offset of this section in the source file */
  char_offset: number;
  /** Explicit chunk ID if provided; null if generated */
  explicit_id: string | null;
  /** Compressed operational summary (from <!-- chunk:summary=... --> or null) */
  summary: string | null;
}

// ── ID Helpers ─────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function fileStem(filePath: string): string {
  return path.basename(filePath, path.extname(filePath));
}

/**
 * Extract explicit chunk ID from lines immediately following a heading.
 * Looks for <!-- chunk:id=some.id --> within the first 3 content lines.
 */
function extractExplicitId(contentLines: string[]): string | null {
  for (const line of contentLines.slice(0, 3)) {
    const match = line.match(/<!--\s*chunk:id=([a-zA-Z0-9._-]+)\s*-->/);
    if (match) return match[1];
  }
  return null;
}

/**
 * Extract explicit summary from lines immediately following a heading.
 * Looks for <!-- chunk:summary=some text --> within the first 5 content lines.
 */
function extractSummary(contentLines: string[]): string | null {
  for (const line of contentLines.slice(0, 5)) {
    const match = line.match(/<!--\s*chunk:summary=(.+?)\s*-->/);
    if (match) return match[1].trim();
  }
  return null;
}

function sha256(text: string): string {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

// ── Parser ─────────────────────────────────────────────────────────────────────

/**
 * Parse markdown content into a list of chunks.
 * Splits at H1 (# ) and H2 (## ) boundaries only.
 */
function parseChunks(filePath: string, content: string): MarkdownChunk[] {
  const stem = fileStem(filePath);
  const lines = content.split("\n");
  const chunks: MarkdownChunk[] = [];

  let currentHeading: string | null = null;
  let currentLevel: 1 | 2 | null = null;
  let currentLines: string[] = [];
  let currentOffset = 0;
  let charOffset = 0;

  const flushChunk = (nextOffset: number): void => {
    if (!currentHeading || !currentLevel) return;

    // Content lines are everything after the heading line
    const contentLines = currentLines.slice(1);
    const explicitId = extractExplicitId(contentLines);
    const summary = extractSummary(contentLines);
    const chunk_id = explicitId ?? `${stem}.${slugify(currentHeading)}`;
    const content = currentLines.join("\n");

    chunks.push({
      chunk_id,
      heading: currentHeading,
      heading_level: currentLevel,
      content,
      hash: sha256(content),
      file: filePath,
      char_offset: currentOffset,
      explicit_id: explicitId,
      summary,
    });
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const h1 = line.match(/^# (.+)/);
    const h2 = line.match(/^## (.+)/);

    if (h1 || h2) {
      // Flush previous chunk
      flushChunk(charOffset);

      // Start new chunk
      currentHeading = h1?.[1].trim() ?? h2![1].trim();
      currentLevel = h1 ? 1 : 2;
      currentOffset = charOffset;
      currentLines = [line];
    } else if (currentHeading) {
      currentLines.push(line);
    }

    charOffset += line.length + 1; // +1 for the \n
  }

  // Flush last chunk
  flushChunk(charOffset);

  return chunks;
}

// ── Chunk Loader ───────────────────────────────────────────────────────────────

export class ChunkLoader {
  private chunkCache = new Map<string, MarkdownChunk[]>();

  /**
   * Load and parse all chunks from a markdown file.
   * Results are cached in-process (keyed by file path).
   */
  loadChunks(filePath: string): MarkdownChunk[] {
    const resolved = path.resolve(filePath);
    if (this.chunkCache.has(resolved)) {
      return this.chunkCache.get(resolved)!;
    }

    if (!fs.existsSync(resolved)) {
      throw new Error(`[ChunkLoader] File not found: ${resolved}`);
    }

    const content = fs.readFileSync(resolved, "utf-8");
    const chunks = parseChunks(resolved, content);
    this.chunkCache.set(resolved, chunks);
    return chunks;
  }

  /**
   * Get a single chunk by its stable chunk ID.
   * Returns null if the chunk ID is not found in the file.
   */
  getChunkById(filePath: string, chunkId: string): MarkdownChunk | null {
    const chunks = this.loadChunks(filePath);
    return chunks.find((c) => c.chunk_id === chunkId) ?? null;
  }

  /**
   * Get multiple chunks by their stable chunk IDs.
   * Unknown IDs are silently skipped.
   */
  getChunksByIds(filePath: string, chunkIds: string[]): MarkdownChunk[] {
    const chunks = this.loadChunks(filePath);
    const idSet = new Set(chunkIds);
    return chunks.filter((c) => idSet.has(c.chunk_id));
  }

  /**
   * Resolve a heading text string to its stable chunk ID.
   * Useful for migration: code that previously referenced headings by text.
   */
  resolveChunkId(filePath: string, heading: string): string | null {
    const chunks = this.loadChunks(filePath);
    const match = chunks.find(
      (c) => c.heading.toLowerCase() === heading.toLowerCase()
    );
    return match?.chunk_id ?? null;
  }

  /**
   * List all chunk IDs in a file (useful for building the context manifest).
   */
  listChunkIds(filePath: string): string[] {
    return this.loadChunks(filePath).map((c) => c.chunk_id);
  }

  /**
   * Invalidate the in-process chunk cache for a file.
   * Call this when a file is modified (triggered by file.edited events).
   */
  evictFile(filePath: string): void {
    this.chunkCache.delete(path.resolve(filePath));
  }

  /**
   * Clear the entire in-process chunk cache.
   */
  clearCache(): void {
    this.chunkCache.clear();
  }
}
