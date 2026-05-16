/**
 * impact-analyzer.ts — Blast Radius & Impact Analysis
 *
 * Wraps the GraphEngine with higher-level impact analysis functions.
 * Provides formatted output suitable for supervisor reports.
 */

import { GraphEngine } from "./graph-engine.js";
import type { BlastRadius } from "../schemas/graph-schema.js";

// ── Formatted Report ───────────────────────────────────────────────────────

export interface ImpactReport {
  node_id: string;
  blast_radius: BlastRadius;
  summary: string;
  formatted: string;
  generated_at: string;
}

// ── Analyzer ───────────────────────────────────────────────────────────────

export class ImpactAnalyzer {
  constructor(private engine: GraphEngine) {}

  /**
   * Analyze the impact of changing a specific node.
   * Returns a structured report with human-readable summary.
   */
  async analyzeNode(nodeId: string): Promise<ImpactReport> {
    const blast = this.engine.getBlastRadius(nodeId);
    const totalAffected = blast.directly_affected.length + blast.transitively_affected.length;

    const summary =
      totalAffected === 0
        ? `Changing "${nodeId}" has no detected downstream impact.`
        : `Changing "${nodeId}" affects ${blast.directly_affected.length} direct and ` +
          `${blast.transitively_affected.length} transitive node(s). ` +
          `Severity: ${blast.severity.toUpperCase()}.`;

    const formatted = this.formatBlastRadius(blast);

    return {
      node_id: nodeId,
      blast_radius: blast,
      summary,
      formatted,
      generated_at: new Date().toISOString(),
    };
  }

  /**
   * Analyze multiple nodes and sort by severity (critical first).
   */
  async analyzeNodes(nodeIds: string[]): Promise<ImpactReport[]> {
    const severityOrder: Record<string, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
    };

    const reports = await Promise.all(nodeIds.map((id) => this.analyzeNode(id)));
    return reports.sort(
      (a, b) =>
        severityOrder[a.blast_radius.severity] - severityOrder[b.blast_radius.severity]
    );
  }

  /**
   * Format blast radius as a human-readable report section.
   */
  private formatBlastRadius(blast: BlastRadius): string {
    const bar = "━".repeat(50);
    const lines: string[] = [
      `Blast Radius: ${blast.node.id}`,
      bar,
      `  Severity:            ${blast.severity.toUpperCase()}`,
      `  Confidence:          ${(blast.confidence * 100).toFixed(0)}%`,
      `  Directly affected:   ${blast.directly_affected.length} node(s)`,
    ];

    if (blast.directly_affected.length > 0) {
      for (const n of blast.directly_affected) {
        lines.push(`    → ${n.id} (${n.type})`);
      }
    }

    lines.push(`  Transitively affected: ${blast.transitively_affected.length} node(s)`);

    if (blast.transitively_affected.length > 0 && blast.transitively_affected.length <= 10) {
      for (const n of blast.transitively_affected) {
        lines.push(`    ⤷ ${n.id}`);
      }
    } else if (blast.transitively_affected.length > 10) {
      lines.push(`    ⤷ [${blast.transitively_affected.length} nodes — run /graph blast-radius for full list]`);
    }

    if (blast.affected_features.length > 0) {
      lines.push(`  Affected features:   ${blast.affected_features.join(", ")}`);
    }

    lines.push(bar);
    lines.push(`  Recommendation: ${blast.recommendation}`);

    return lines.join("\n");
  }
}
