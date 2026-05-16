/**
 * index.ts — Context Resolver (Public Facade)
 *
 * Single import point for all context resolution in the OAC framework.
 * Composes FingerprintEngine, ChunkLoader, and DependencyResolver into
 * one cohesive ContextResolver class.
 *
 * Usage:
 *   import { ContextResolver } from "../tool/context-resolver/index.js";
 *   const resolver = new ContextResolver();
 *   const bundle = await resolver.resolve("code-reviewer");
 *
 * The returned bundle contains:
 *   - Resolved dependency file paths
 *   - Per-file fingerprints (for cache invalidation)
 *   - Composite dependency hash (used as cache key)
 *   - Loaded chunks (filtered to relevant sections)
 */

import * as fs from "fs";
import * as path from "path";
import { FingerprintEngine, type FileFingerprint } from "./fingerprint-engine.js";
import { ChunkLoader, type MarkdownChunk } from "./chunk-loader.js";
import {
  resolveDeps,
  resolveCommandDeps,
  resolvePolicies,
  getConsumers,
  getAllContextFiles,
  type ResolvedDeps,
} from "./dependency-resolver.js";

export type { ResolvedDeps };

/** Detail level for context loading */
export type ContextDetail = "full" | "summary" | "symbolic";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface LoadedChunkMap {
  [filePath: string]: MarkdownChunk[];
}

export interface ResolvedContextBundle {
  /** Agent or command that was resolved */
  consumer: string;
  /** Resolved dependency paths and flags */
  deps: ResolvedDeps;
  /** Per-file fingerprints (path → FileFingerprint) */
  fingerprints: Record<string, FileFingerprint>;
  /** Composite dependency hash — use as cache key */
  dependency_hash: string;
  /** Loaded markdown chunks per file (only for files that exist) */
  chunks: LoadedChunkMap;
  /** Files that were missing at resolution time (non-fatal, logged) */
  missing_files: string[];
}

// ── Context Resolver ───────────────────────────────────────────────────────────

export class ContextResolver {
  private fingerprinter = new FingerprintEngine();
  private chunkLoader = new ChunkLoader();

  /**
   * Resolve context for a specific agent.
   * Returns a bundle with fingerprints, chunk content, and dependency hash.
   *
   * @param agentId - Agent identifier
   * @param detail  - Level of context to load:
   *   - "full": All chunk content (default, backward compatible)
   *   - "summary": Only chunk summaries (~80% token savings)
   *   - "symbolic": Only chunk IDs and headings (minimal tokens)
   */
  async resolve(
    agentId: string,
    detail: ContextDetail = "full"
  ): Promise<ResolvedContextBundle> {
    const deps = resolveDeps(agentId);
    return this._buildBundle(agentId, deps, detail);
  }

  /**
   * Resolve context for a slash command invocation.
   * Example: resolveCommand("/audit architecture")
   */
  async resolveCommand(
    command: string,
    detail: ContextDetail = "full"
  ): Promise<ResolvedContextBundle> {
    const deps = resolveCommandDeps(command);
    return this._buildBundle(command, deps, detail);
  }

  /**
   * Resolve policy modules for a given task type.
   * Returns file paths only — no chunking needed for policy files.
   */
  resolvePoliciesForTask(taskType: string): string[] {
    return resolvePolicies(taskType);
  }

  /**
   * Selectively invalidate cached chunks for a changed file.
   * Call this when a file.edited or file.watcher.updated event fires.
   */
  invalidate(changedFilePath: string): { evicted_files: string[]; affected_agents: string[] } {
    const resolved = path.resolve(changedFilePath);
    this.chunkLoader.evictFile(resolved);
    this.fingerprinter.evictMtimeCache(resolved);
    const affectedAgents = getConsumers(changedFilePath);
    return { evicted_files: [resolved], affected_agents: affectedAgents };
  }

  /**
   * Invalidate all in-process caches.
   * Use sparingly — prefer selective invalidation.
   */
  invalidateAll(): void {
    this.chunkLoader.clearCache();
    this.fingerprinter.clearMtimeCache();
  }

  /**
   * Build the context manifest from scratch.
   * Call once on first run, or after adding new agents.
   */
  async buildContextManifest(): Promise<void> {
    const allFiles = getAllContextFiles();
    for (const filePath of allFiles) {
      if (fs.existsSync(filePath)) {
        // Loading chunks triggers context manifest update via dependency-resolver
        try { this.chunkLoader.loadChunks(filePath); } catch { /* skip missing */ }
      }
    }
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  private _buildBundle(
    consumer: string,
    deps: ResolvedDeps,
    detail: ContextDetail = "full"
  ): ResolvedContextBundle {
    const allFiles = [...deps.context_files, ...deps.registry_files];
    const fingerprints: Record<string, FileFingerprint> = {};
    const chunks: LoadedChunkMap = {};
    const missing_files: string[] = [];

    for (const filePath of allFiles) {
      if (!fs.existsSync(filePath)) {
        missing_files.push(filePath);
        continue;
      }

      try {
        fingerprints[filePath] = this.fingerprinter.fingerprintFile(filePath);
      } catch {
        missing_files.push(filePath);
        continue;
      }

      // Only chunk markdown files
      if (filePath.endsWith(".md")) {
        try {
          const chunkFilter = deps.chunk_filters[filePath];
          let loaded: MarkdownChunk[];
          if (chunkFilter && chunkFilter.length > 0) {
            loaded = this.chunkLoader.getChunksByIds(filePath, chunkFilter);
          } else {
            loaded = this.chunkLoader.loadChunks(filePath);
          }

          // Apply detail-level compression
          if (detail === "summary") {
            loaded = loaded.map((chunk) => ({
              ...chunk,
              content: chunk.summary ?? `[${chunk.chunk_id}] ${chunk.heading}`,
            }));
          } else if (detail === "symbolic") {
            loaded = loaded.map((chunk) => ({
              ...chunk,
              content: `[${chunk.chunk_id}]`,
            }));
          }

          chunks[filePath] = loaded;
        } catch {
          missing_files.push(filePath);
        }
      }
    }

    const existingPaths = allFiles.filter((f) => fs.existsSync(f));
    const dependency_hash = this.fingerprinter.fingerprintDependencyTree(existingPaths);

    return {
      consumer,
      deps,
      fingerprints,
      dependency_hash,
      chunks,
      missing_files,
    };
  }
}
