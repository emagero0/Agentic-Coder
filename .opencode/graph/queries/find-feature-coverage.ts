/**
 * find-feature-coverage.ts
 * Query: "Which nodes implement feature Y, and is coverage complete?"
 *
 * Cross-references verified features with architecture nodes via the
 * cross_registry_links index. Used by ProjectManagerSupervisor during
 * /audit features to detect incomplete feature implementations.
 */

import { GraphEngine } from "../engine/graph-engine.js";
import type { FeatureCoverage } from "../schemas/graph-schema.js";

export interface FeatureCoverageResult {
  coverage: FeatureCoverage;
  formatted_summary: string;
  queried_at: string;
}

/**
 * Get the architecture node coverage for a verified feature.
 *
 * @param engine    A loaded GraphEngine instance
 * @param featureId The feature slug from the verified feature registry
 */
export function findFeatureCoverage(
  engine: GraphEngine,
  featureId: string
): FeatureCoverageResult {
  const coverage = engine.getFeatureCoverage(featureId);

  const lines: string[] = [
    `Feature Coverage: ${featureId}`,
    "━".repeat(50),
    `  Status:     ${coverage.coverage_status.toUpperCase()}`,
    `  Confidence: ${(coverage.confidence * 100).toFixed(0)}%`,
    `  Nodes:      ${coverage.implementing_nodes.length}`,
  ];

  for (const node of coverage.implementing_nodes) {
    const verifiedTag = node.verified ? "✓" : "~";
    lines.push(`    ${verifiedTag} ${node.id} (${node.type})`);
  }

  if (coverage.gaps.length > 0) {
    lines.push(`  Gaps:`);
    for (const gap of coverage.gaps) {
      lines.push(`    ⚠ ${gap}`);
    }
  }

  return {
    coverage,
    formatted_summary: lines.join("\n"),
    queried_at: new Date().toISOString(),
  };
}
