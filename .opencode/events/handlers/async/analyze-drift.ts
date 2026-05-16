/**
 * Tier 2 Handler: analyze-drift
 *
 * Async background handler triggered by file changes.
 * Detects architectural drift by comparing observed file changes
 * against the inferred architecture graph.
 *
 * Output:
 *   - drift.analysis report to events/outputs/
 *   - Structured PR review markdown to events/outputs/reviews/
 *     (compatible with GitHub PR comment format)
 *
 * Never modifies source code or verified state.
 */

import type { RuntimeAdapter } from "../../adapters/runtime/bun/index.js";

export interface FileChangedEvent {
  type: "file.watcher.updated" | "file.edited" | "session.completed";
  path?: string;
  timestamp: string;
}

// ─── Drift Signal ──────────────────────────────────────────────────────────

interface DriftSignal {
  severity: "info" | "warning" | "error";
  category: "missing_node" | "orphan_file" | "pattern_violation" | "naming_inconsistency" | "metadata_stale" | "import_mismatch";
  message: string;
  file: string;
  recommendation: string;
}

// ─── PR Review Output ──────────────────────────────────────────────────────

export interface ArchitectureReview {
  event_type: "architecture.review";
  tier: 2;
  timestamp: string;
  trigger: string;
  file_analyzed: string;
  summary: {
    total_signals: number;
    errors: number;
    warnings: number;
    info: number;
    review_verdict: "pass" | "needs_attention" | "blocking";
  };
  signals: DriftSignal[];
  review_markdown: string;
}

/**
 * Analyze whether a file change introduces architectural drift.
 * Produces both a structured report and a markdown PR review.
 */
export async function handleAnalyzeDrift(
  event: FileChangedEvent,
  adapter: RuntimeAdapter
): Promise<void> {
  adapter.log(`[analyze-drift] Triggered by ${event.type} on ${event.path ?? "session"}`);

  const graphPath = ".opencode/state/inferred/architecture/architecture-graph.json";
  const graph = await adapter.readJSON(graphPath).catch(() => null);

  if (!graph) {
    adapter.log("[analyze-drift] No architecture graph found — run /scan-state first");
    return;
  }

  const signals: DriftSignal[] = [];

  if (event.path) {
    const filePath = event.path;

    // 1. Check if file is in an architecture-sensitive location
    if (isArchitectureSensitive(filePath)) {
      signals.push({
        severity: "warning",
        category: "pattern_violation",
        message: `Change in architecture-sensitive path: ${filePath}`,
        file: filePath,
        recommendation: "Run /audit architecture to verify no pattern violations were introduced",
      });
    }

    // 2. Check if file is known to the architecture graph
    const knownPaths = extractNodePaths(graph);
    const isKnown = knownPaths.some((kp: string) => filePath.includes(kp));
    if (!isKnown && isSourceFile(filePath)) {
      signals.push({
        severity: "warning",
        category: "orphan_file",
        message: `Source file not tracked in architecture graph: ${filePath}`,
        file: filePath,
        recommendation:
          "Add this file to the architecture graph via /audit architecture, " +
          "or verify it's a utility that doesn't need tracking",
      });
    }

    // 3. Naming convention check against existing handlers
    const fileName = filePath.split(/[/\\]/).pop() ?? "";
    const handlerNodes = extractHandlerNodes(graph);
    const hasHandlerPattern = handlerNodes.some((h: string) => fileName.includes(h));
    if (handlerNodes.length > 0 && isHandlerSensitive(filePath) && !hasHandlerPattern) {
      signals.push({
        severity: "info",
        category: "naming_inconsistency",
        message: `New handler file "${fileName}" doesn't match existing handler naming pattern`,
        file: filePath,
        recommendation: `Existing handlers follow pattern: ${handlerNodes.join(", ")}`,
      });
    }
  }

  // Generate structured review output
  const errors = signals.filter((s) => s.severity === "error").length;
  const warnings = signals.filter((s) => s.severity === "warning").length;
  const infos = signals.filter((s) => s.severity === "info").length;
  const verdict = errors > 0 ? "blocking" : warnings > 0 ? "needs_attention" : "pass";

  const reviewMd = formatReviewMarkdown(event.path ?? "unknown", signals, verdict);

  const review: ArchitectureReview = {
    event_type: "architecture.review",
    tier: 2,
    timestamp: event.timestamp ?? new Date().toISOString(),
    trigger: `${event.type} on ${event.path ?? "session"}`,
    file_analyzed: event.path ?? "N/A",
    summary: {
      total_signals: signals.length,
      errors,
      warnings,
      info: infos,
      review_verdict: verdict,
    },
    signals,
    review_markdown: reviewMd,
  };

  // Write structured report
  await adapter.appendOutput(review, `drift-review-${Date.now()}.json`);

  // Write human-readable markdown review (PR-compatible format)
  const reviewDir = ".opencode/events/outputs/reviews";
  adapter.ensureDirectory(reviewDir);
  const reviewFileName = `review-${Date.now()}.md`;
  adapter.writeTextFile(`${reviewDir}/${reviewFileName}`, reviewMd);

  adapter.log(
    `[analyze-drift] Review written: ${signals.length} signals, verdict: ${verdict}`
  );
}

// ─── PR Review Markdown Formatter ─────────────────────────────────────────

/**
 * Format drift signals as a markdown PR review comment.
 * Compatible with GitHub PR comment markdown.
 */
function formatReviewMarkdown(
  filePath: string,
  signals: DriftSignal[],
  verdict: string
): string {
  const emoji = verdict === "pass" ? "✅" : verdict === "needs_attention" ? "⚠️" : "🚫";

  const lines: string[] = [
    `## ${emoji} Architecture Review: \`${filePath}\``,
    "",
    `**Verdict:** \`${verdict}\` | **Signals:** ${signals.length}`,
    "",
  ];

  if (signals.length === 0) {
    lines.push("No architectural concerns detected. This change is consistent with the existing architecture.");
    lines.push("");
    return lines.join("\n");
  }

  // Group signals by severity
  const groups: Record<string, DriftSignal[]> = { error: [], warning: [], info: [] };
  for (const s of signals) {
    groups[s.severity]?.push(s);
  }

  if (groups.error.length > 0) {
    lines.push("### 🚫 Blocking Issues");
    lines.push("");
    for (const s of groups.error) {
      lines.push(`- **${s.message}**`);
      lines.push(`  - *Fix:* ${s.recommendation}`);
    }
    lines.push("");
  }

  if (groups.warning.length > 0) {
    lines.push("### ⚠️ Warnings");
    lines.push("");
    for (const s of groups.warning) {
      lines.push(`- **${s.message}**`);
      lines.push(`  - *Suggestion:* ${s.recommendation}`);
    }
    lines.push("");
  }

  if (groups.info.length > 0) {
    lines.push("### ℹ️ Notes");
    lines.push("");
    for (const s of groups.info) {
      lines.push(`- ${s.message}`);
      if (s.recommendation) lines.push(`  - *${s.recommendation}*`);
    }
    lines.push("");
  }

  lines.push("---");
  lines.push("_Auto-generated by OAC Architecture Supervisor. Run `/audit architecture` for full analysis._");
  lines.push("");

  return lines.join("\n");
}

// ─── Detection Helpers ────────────────────────────────────────────────────

const ARCHITECTURE_SENSITIVE_PATTERNS = [
  /\/api\//,
  /\/routes\//,
  /\/pages\//,
  /\/app\//,
  /\/services\//,
  /\/middleware\//,
  /\/db\//,
  /\/migrations\//,
  /\.config\.(ts|js)$/,
  /\/events\/handlers\//,
  /\/graph\//,
  /\/tool\//,
];

function isArchitectureSensitive(path: string): boolean {
  return ARCHITECTURE_SENSITIVE_PATTERNS.some((p) => p.test(path));
}

const HANDLER_SENSITIVE_PATTERNS = [
  /\/handlers\//,
  /\/queries\//,
  /\/engine\//,
];

function isHandlerSensitive(path: string): boolean {
  return HANDLER_SENSITIVE_PATTERNS.some((p) => p.test(path));
}

function isSourceFile(path: string): boolean {
  return /\.(ts|tsx|js|jsx|py|go|rs|md)$/.test(path);
}

function extractNodePaths(graph: Record<string, unknown>): string[] {
  const nodes = graph["nodes"];
  if (!Array.isArray(nodes)) return [];
  return nodes.map((n: Record<string, unknown>) => n["path"] as string).filter(Boolean);
}

function extractHandlerNodes(graph: Record<string, unknown>): string[] {
  const nodes = graph["nodes"];
  if (!Array.isArray(nodes)) return [];
  return nodes
    .filter((n: Record<string, unknown>) => {
      const pattern = n["pattern"] as string;
      return pattern && (pattern.includes("handler") || pattern.includes("sync") || pattern.includes("async"));
    })
    .map((n: Record<string, unknown>) => n["id"] as string)
    .filter(Boolean);
}
