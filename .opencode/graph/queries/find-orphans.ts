/**
 * find-orphans.ts
 * Query: "Which modules have no inbound or outbound relationships?"
 *
 * Identifies orphaned nodes — dead code candidates that are neither
 * imported nor import anything else. Surfaced by MemoryCurator in hygiene reports.
 */

import { GraphEngine } from "../engine/graph-engine.js";
import type { GraphNode } from "../schemas/graph-schema.js";

export interface OrphansResult {
  orphans: GraphNode[];
  count: number;
  verified_orphans: number;
  unverified_orphans: number;
  recommendation: string;
  queried_at: string;
}

/**
 * Find all orphan nodes (no inbound AND no outbound edges).
 *
 * @param engine A loaded GraphEngine instance
 */
export function findOrphans(engine: GraphEngine): OrphansResult {
  const orphans = engine.findOrphans();
  const verified = orphans.filter((n) => n.verified);
  const unverified = orphans.filter((n) => !n.verified);

  const recommendation =
    orphans.length === 0
      ? "No orphans detected. Architecture is well-connected."
      : verified.length > 0
      ? `${verified.length} verified orphan(s) detected — likely dead code. Review for removal.`
      : `${unverified.length} unverified orphan(s) detected — may be scaffolding or entry points not yet mapped.`;

  return {
    orphans,
    count: orphans.length,
    verified_orphans: verified.length,
    unverified_orphans: unverified.length,
    recommendation,
    queried_at: new Date().toISOString(),
  };
}
