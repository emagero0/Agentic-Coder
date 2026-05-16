/**
 * find-blast-radius.ts
 * Query: "What is the blast radius if X changes?"
 *
 * Wraps GraphEngine.getBlastRadius with structured output suitable
 * for supervisor reports and the /graph blast-radius command.
 */

import { GraphEngine } from "../engine/graph-engine.js";
import { ImpactAnalyzer } from "../engine/impact-analyzer.js";
import type { ImpactReport } from "../engine/impact-analyzer.js";

export interface BlastRadiusResult {
  report: ImpactReport;
  queried_at: string;
}

/**
 * Compute the blast radius of changing `nodeId`.
 *
 * @param engine  A loaded GraphEngine instance
 * @param nodeId  The node whose change impact to analyze
 */
export async function findBlastRadius(
  engine: GraphEngine,
  nodeId: string
): Promise<BlastRadiusResult> {
  const analyzer = new ImpactAnalyzer(engine);
  const report = await analyzer.analyzeNode(nodeId);
  return {
    report,
    queried_at: new Date().toISOString(),
  };
}
