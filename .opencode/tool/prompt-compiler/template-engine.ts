/**
 * template-engine.ts — Prompt Template Engine
 *
 * Separates static prompt parts (supervisor instructions, standards) from
 * dynamic parts (current state values, graph summaries) so that only dynamic
 * parts need recomputation when state changes.
 *
 * Terminology:
 *   CompiledTemplate — static part of a prompt, long-lived (24h TTL)
 *   StateSlice       — dynamic state snapshot injected at invocation time
 *   CompiledPrompt   — final assembled string ready to send to LLM
 *
 * Design constraints:
 *   - Never caches unverified inferred state as authoritative
 *   - Classification of output depends on input classification
 *   - State slices from inferred state produce inferred cache entries
 *   - State slices from verified state produce deterministic cache entries
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

// ── Types ──────────────────────────────────────────────────────────────────────

export type CacheClassification = "deterministic" | "inferred" | "speculative";

export interface CompiledTemplate {
  /** Unique ID for this template */
  template_id: string;
  /** SHA-256 hash of the static content */
  template_hash: string;
  /** The static instruction content */
  static_content: string;
  /** Variable placeholder names found in the template ({{VARIABLE_NAME}}) */
  placeholders: string[];
  /** Source file this was compiled from */
  source_file: string;
  /** Classification of source (determines max classification of output) */
  source_classification: CacheClassification;
}

export interface StateSlice {
  /** Variable name → value pairs, matched against placeholders */
  variables: Record<string, string>;
  /** What state sources were used to build this slice */
  sources: Array<{
    path: string;
    hash: string;
    classification: CacheClassification;
  }>;
}

export interface CompiledPrompt {
  /** Final text ready to send to the LLM */
  content: string;
  /** Composite hash of template + all state sources */
  content_hash: string;
  /** The highest-risk classification from all inputs */
  effective_classification: CacheClassification;
  /** All dependency paths (for cache invalidation) */
  dep_paths: string[];
  /** All dependency hashes at compile time */
  dep_hashes: string[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function sha256(text: string): string {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * Resolve classification: most restrictive (speculative > inferred > deterministic)
 */
function resolveClassification(
  ...classifications: CacheClassification[]
): CacheClassification {
  if (classifications.includes("speculative")) return "speculative";
  if (classifications.includes("inferred")) return "inferred";
  return "deterministic";
}

/**
 * Extract {{PLACEHOLDER_NAME}} patterns from template content.
 */
function extractPlaceholders(content: string): string[] {
  const matches = content.match(/\{\{([A-Z_]+)\}\}/g) ?? [];
  return [...new Set(matches.map((m) => m.slice(2, -2)))];
}

/**
 * Compress a long text to a summary header + truncated body.
 * Used to prevent supervisor context explosion.
 */
function compressContext(
  content: string,
  maxChars = 8000,
  label = "Context"
): string {
  if (content.length <= maxChars) return content;
  const truncated = content.slice(0, maxChars);
  const lineBreak = truncated.lastIndexOf("\n");
  const safe = lineBreak > 0 ? truncated.slice(0, lineBreak) : truncated;
  return `${safe}\n\n[${label}: truncated at ${maxChars} chars — ${content.length - maxChars} chars omitted]`;
}

// ── Template Engine ────────────────────────────────────────────────────────────

export class TemplateEngine {
  /**
   * Compile a static template from a markdown file.
   * The resulting CompiledTemplate can be cached long-term.
   * Only needs recompilation when the source file changes.
   */
  compileStatic(
    agentMdPath: string,
    options: { maxContextChars?: number } = {}
  ): CompiledTemplate {
    if (!fs.existsSync(agentMdPath)) {
      throw new Error(`[TemplateEngine] Agent file not found: ${agentMdPath}`);
    }

    const raw = fs.readFileSync(agentMdPath, "utf-8");
    const content = options.maxContextChars
      ? compressContext(raw, options.maxContextChars, path.basename(agentMdPath))
      : raw;

    const templateHash = sha256(content);
    const placeholders = extractPlaceholders(content);
    const templateId = `template:${path.basename(agentMdPath, ".md")}:${templateHash.slice(0, 8)}`;

    return {
      template_id: templateId,
      template_hash: templateHash,
      static_content: content,
      placeholders,
      source_file: agentMdPath,
      source_classification: "deterministic",  // instruction files are stable
    };
  }

  /**
   * Inject dynamic state into a compiled template.
   * Returns the final prompt string + metadata for caching.
   *
   * Classification is resolved to the most restrictive of:
   * template.source_classification and all state.sources[].classification
   */
  compileDynamic(template: CompiledTemplate, state: StateSlice): CompiledPrompt {
    let content = template.static_content;

    // Replace all {{PLACEHOLDER}} tokens
    for (const [key, value] of Object.entries(state.variables)) {
      const placeholder = `{{${key}}}`;
      content = content.split(placeholder).join(value);
    }

    // Warn about unresolved placeholders (but don't fail)
    const unresolved = extractPlaceholders(content);
    if (unresolved.length > 0) {
      content += `\n\n<!-- [TemplateEngine] Unresolved placeholders: ${unresolved.join(", ")} -->`;
    }

    // Compute classification
    const allClassifications: CacheClassification[] = [
      template.source_classification,
      ...state.sources.map((s) => s.classification),
    ];
    const effectiveClassification = resolveClassification(...allClassifications);

    // Compute composite hash
    const allHashes = [template.template_hash, ...state.sources.map((s) => s.hash)];
    const contentHash = sha256(allHashes.sort().join("|"));

    return {
      content,
      content_hash: contentHash,
      effective_classification: effectiveClassification,
      dep_paths: [template.source_file, ...state.sources.map((s) => s.path)],
      dep_hashes: [template.template_hash, ...state.sources.map((s) => s.hash)],
    };
  }

  /**
   * Deduplicate content sections by SHA-256 hash.
   * Splits on H1/H2 boundaries and removes sections whose content
   * has already been seen. Returns the deduplicated text.
   *
   * This prevents the same context block (e.g., code-quality standards)
   * from appearing multiple times when referenced by multiple consumers.
   */
  deduplicateSections(content: string): string {
    const lines = content.split("\n");
    const sections: string[][] = [[]];

    for (const line of lines) {
      if (/^#{1,2} /.test(line) && sections[sections.length - 1].length > 0) {
        sections.push([]);
      }
      sections[sections.length - 1].push(line);
    }

    const seen = new Set<string>();
    const unique: string[][] = [];

    for (const section of sections) {
      const text = section.join("\n").trim();
      if (!text) continue;
      const hash = sha256(text);
      if (seen.has(hash)) continue;
      seen.add(hash);
      unique.push(section);
    }

    return unique.map((s) => s.join("\n")).join("\n");
  }

  /**
   * Build a compressed supervisor context bundle.
   * Reads the supervisor markdown + a pre-resolved state snapshot
   * and assembles a minimal, token-efficient prompt.
   *
   * The bundle is classified as "inferred" if state contains inferred data,
   * "deterministic" if all inputs are from verified state.
   */
  buildSupervisorBundle(
    supervisorId: string,
    supervisorMdPath: string,
    stateSlice: StateSlice,
    options: { maxContextChars?: number } = {}
  ): CompiledPrompt {
    const template = this.compileStatic(supervisorMdPath, options);
    // Deduplicate sections before dynamic compilation
    const deduped: typeof template = {
      ...template,
      static_content: this.deduplicateSections(template.static_content),
      template_hash: sha256(this.deduplicateSections(template.static_content)),
    };
    return this.compileDynamic(deduped, stateSlice);
  }

  /**
   * Compress a long state JSON into a compact summary.
   * Used when injecting registry state into supervisor prompts.
   */
  compressStateSlice(state: unknown, label: string, maxChars = 4000): string {
    const json = JSON.stringify(state, null, 2);
    return compressContext(json, maxChars, label);
  }
}
