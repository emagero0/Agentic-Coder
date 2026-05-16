/**
 * index.ts — Prompt Compiler (Public Facade)
 *
 * Single import point for prompt compilation in the OAC framework.
 * Composes CacheManager and TemplateEngine into one PromptCompiler class.
 *
 * Usage:
 *   import { PromptCompiler } from "../tool/prompt-compiler/index.js";
 *   const compiler = new PromptCompiler();
 *   const result = await compiler.compile("architecture-supervisor", bundle, stateSlice);
 *
 * Cache behavior:
 *   - Static templates cached in deterministic/ (24h TTL)
 *   - Dynamic compilations cached by classification of their inputs
 *   - All cache entries include metadata envelopes
 *   - Stale entries are detected by dep hash comparison, not TTL alone
 */

import * as path from "path";
import { CacheManager, type CacheMeta, type CacheHit } from "./cache-manager.js";
import { TemplateEngine, type CompiledTemplate, type StateSlice, type CompiledPrompt } from "./template-engine.js";
import type { ResolvedContextBundle } from "../context-resolver/index.js";
import { expandSymbols } from "./symbol-registry.js";

export type { CompiledTemplate, StateSlice, CompiledPrompt };

// ── Types ──────────────────────────────────────────────────────────────────────

export interface CompilerResult {
  /** The final compiled prompt content */
  content: string;
  /** Whether this was served from cache */
  cache_hit: boolean;
  /** Classification of this result */
  classification: "deterministic" | "inferred" | "speculative";
  /** Composite hash of all inputs */
  content_hash: string;
}

// ── Prompt Compiler ────────────────────────────────────────────────────────────

export class PromptCompiler {
  private cache = new CacheManager();
  private engine = new TemplateEngine();

  /**
   * Compile a prompt for an agent or supervisor.
   *
   * Steps:
   *   1. Check cache using (agentId + dependency_hash) as key
   *   2. If hit and not stale: return cached content
   *   3. Otherwise: compile static template + inject state, then cache
   *
   * @param agentId       - Agent identifier (used in cache key)
   * @param agentMdPath   - Absolute path to agent's instruction markdown file
   * @param bundle        - Resolved context bundle (from ContextResolver)
   * @param stateSlice    - Dynamic state variables to inject
   */
  async compile(
    agentId: string,
    agentMdPath: string,
    bundle: ResolvedContextBundle,
    stateSlice: StateSlice = { variables: {}, sources: [] }
  ): Promise<CompilerResult> {
    const cacheKey = `${agentId}:prompt:${bundle.dependency_hash}`;
    const depPaths = [...bundle.deps.context_files, ...bundle.deps.registry_files];
    const depHashes = depPaths.map((p) => bundle.fingerprints[p]?.file_hash ?? "");

    // Check cache
    const hit = this.cache.get<string>(cacheKey, depHashes);
    if (hit && !hit.potentially_stale) {
      return {
        content: hit.value,
        cache_hit: true,
        classification: hit.classification,
        content_hash: cacheKey,
      };
    }

    // Compile fresh
    const compiled = this.engine.buildSupervisorBundle(
      agentId,
      agentMdPath,
      stateSlice,
      { maxContextChars: 12000 }
    );

    // Expand symbolic references before caching
    compiled.content = expandSymbols(compiled.content);

    const meta: CacheMeta = {
      classification: compiled.effective_classification,
      dependencies: compiled.dep_paths,
      source_hashes: compiled.dep_hashes,
      invalidation_events: ["file.edited", "state.registry.write", "audit.promotion.confirmed"],
      generator: "prompt-compiler",
    };

    this.cache.set(cacheKey, compiled.content, meta);

    return {
      content: compiled.content,
      cache_hit: false,
      classification: compiled.effective_classification,
      content_hash: compiled.content_hash,
    };
  }

  /**
   * Check whether the current cache for an agent is still valid.
   * Returns false if any dependency has changed since last cache write.
   */
  isCacheValid(agentId: string, bundle: ResolvedContextBundle): boolean {
    const cacheKey = `${agentId}:prompt:${bundle.dependency_hash}`;
    const depHashes = [...bundle.deps.context_files, ...bundle.deps.registry_files]
      .map((p) => bundle.fingerprints[p]?.file_hash ?? "");
    const hit = this.cache.get<string>(cacheKey, depHashes);
    return hit !== null && !hit.potentially_stale;
  }

  /**
   * Forcibly invalidate the prompt cache for a given agent.
   */
  invalidate(agentId: string, bundleDependencyHash: string): void {
    const cacheKey = `${agentId}:prompt:${bundleDependencyHash}`;
    this.cache.invalidateKey(cacheKey);
  }

  /**
   * Invalidate all prompt caches that depend on a changed file.
   * Returns the list of evicted cache keys.
   */
  invalidateByFile(changedFilePath: string): string[] {
    return this.cache.invalidateByDep(changedFilePath);
  }

  /**
   * Return cache statistics.
   */
  stats() {
    return this.cache.stats();
  }

  /**
   * Remove expired entries without touching valid ones.
   * Safe to call periodically (e.g., on session.idle).
   */
  pruneExpired(): number {
    return this.cache.pruneExpired();
  }
}
