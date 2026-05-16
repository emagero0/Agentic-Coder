/**
 * entropy-scanner.ts — Context Health & Entropy Scanner
 *
 * Scans all context files and produces a health report identifying:
 *   - Duplicate content across files
 *   - Stale files (not modified in >30 days)
 *   - Unused files (0 consumers in dependency map)
 *   - Oversized files (exceeding MVI 200-line budget)
 *
 * Design constraints:
 *   - Read-only: never modifies source files
 *   - No external dependencies beyond Node.js built-ins
 *   - Safe to run periodically (e.g., weekly via deferred event handler)
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { getAllContextFiles, getConsumers } from "./dependency-resolver.js";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface DuplicateContent {
  hash: string;
  files: string[];
  /** Approximate number of duplicate lines */
  duplicate_lines: number;
}

export interface StaleFile {
  path: string;
  last_modified: string;
  days_stale: number;
}

export interface UnusedFile {
  path: string;
  /** Agents/supervisors that consume this file (empty = unused) */
  consumers: string[];
}

export interface OversizedFile {
  path: string;
  lines: number;
  limit: number;
}

export interface ContextHealthReport {
  generated_at: string;
  total_files: number;
  total_chunks: number;
  duplicates: DuplicateContent[];
  stale_files: StaleFile[];
  unused_files: UnusedFile[];
  oversized_files: OversizedFile[];
  /** Overall health score: 0.0 (critical) to 1.0 (healthy) */
  health_score: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function sha256(text: string): string {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

function daysSince(dateStr: string): number {
  const then = new Date(dateStr).getTime();
  const now = Date.now();
  return Math.floor((now - then) / (1000 * 60 * 60 * 24));
}

// ── Scanner ────────────────────────────────────────────────────────────────────

const MVI_LINE_LIMIT = 200;
const STALE_THRESHOLD_DAYS = 30;

export function scanContextHealth(): ContextHealthReport {
  const ROOT = process.cwd();
  const allFiles = getAllContextFiles();
  const existingFiles = allFiles.filter((f) => fs.existsSync(f));

  // Track section hashes for duplicate detection
  const sectionHashes = new Map<string, string[]>(); // hash → [file paths]
  let totalChunks = 0;

  const staleFiles: StaleFile[] = [];
  const oversizedFiles: OversizedFile[] = [];
  const unusedFiles: UnusedFile[] = [];

  for (const filePath of existingFiles) {
    const stat = fs.statSync(filePath);
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n");
    const relPath = path.relative(ROOT, filePath).replace(/\\/g, "/");

    // Check staleness
    const lastModified = stat.mtime.toISOString();
    const days = daysSince(lastModified);
    if (days > STALE_THRESHOLD_DAYS) {
      staleFiles.push({ path: relPath, last_modified: lastModified, days_stale: days });
    }

    // Check oversized
    if (lines.length > MVI_LINE_LIMIT) {
      oversizedFiles.push({ path: relPath, lines: lines.length, limit: MVI_LINE_LIMIT });
    }

    // Check unused
    const consumers = getConsumers(filePath);
    if (consumers.length === 0) {
      unusedFiles.push({ path: relPath, consumers });
    }

    // Hash sections for duplicate detection
    const sections: string[] = [];
    let current: string[] = [];
    for (const line of lines) {
      if (/^#{1,2} /.test(line) && current.length > 0) {
        sections.push(current.join("\n").trim());
        current = [];
      }
      current.push(line);
    }
    if (current.length > 0) sections.push(current.join("\n").trim());

    totalChunks += sections.length;

    for (const section of sections) {
      if (section.length < 50) continue; // skip trivial sections
      const hash = sha256(section);
      if (!sectionHashes.has(hash)) sectionHashes.set(hash, []);
      sectionHashes.get(hash)!.push(relPath);
    }
  }

  // Identify duplicates (same hash appearing in multiple files)
  const duplicates: DuplicateContent[] = [];
  for (const [hash, files] of sectionHashes) {
    const uniqueFiles = [...new Set(files)];
    if (uniqueFiles.length > 1) {
      duplicates.push({
        hash: hash.slice(0, 12),
        files: uniqueFiles,
        duplicate_lines: Math.round(files.length * 10), // rough estimate
      });
    }
  }

  // Compute health score (1.0 = perfect, 0.0 = critical)
  const penalties =
    duplicates.length * 0.05 +
    staleFiles.length * 0.03 +
    unusedFiles.length * 0.04 +
    oversizedFiles.length * 0.08;
  const healthScore = Math.max(0, Math.min(1, 1 - penalties));

  return {
    generated_at: new Date().toISOString(),
    total_files: existingFiles.length,
    total_chunks: totalChunks,
    duplicates,
    stale_files: staleFiles,
    unused_files: unusedFiles,
    oversized_files: oversizedFiles,
    health_score: Math.round(healthScore * 100) / 100,
  };
}

/**
 * Write the health report to disk as JSON.
 * Default output: .opencode/events/outputs/context-health-{DATE}.json
 */
export function writeHealthReport(
  outputDir = path.resolve(process.cwd(), ".opencode/events/outputs")
): string {
  const report = scanContextHealth();
  const date = new Date().toISOString().split("T")[0];
  const outputPath = path.join(outputDir, `context-health-${date}.json`);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
  return outputPath;
}
