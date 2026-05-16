/**
 * find-dependents.ts
 * Query: "What modules depend on X?"
 *
 * Returns all nodes (direct and transitive) that import or depend on the
 * specified node. Useful before refactoring, renaming, or removing a module.
 */

import { GraphEngine } from "../engine/graph-engine.js";
import type { GraphNode } from "../schemas/graph-schema.js";

export interface DependentsResult {
  target_node: string;
  direct_dependents: GraphNode[];
  transitive_dependents: GraphNode[];
  total_count: number;
  queried_at: string;
}

/**
 * Find all nodes that directly or transitively depend on `nodeId`.
 *
 * @param engine  A loaded GraphEngine instance
 * @param nodeId  The node to find dependents of
 */
export function findDependents(engine: GraphEngine, nodeId: string): DependentsResult {
  // Direct dependents (single hop, using inbound edges)
  const blast = engine.getBlastRadius(nodeId);
  const directIds = new Set(blast.directly_affected.map((n) => n.id));

  // All dependents (DFS via getDependents)
  const all = engine.getDependents(nodeId);
  const direct = all.filter((n) => directIds.has(n.id));
  const transitive = all.filter((n) => !directIds.has(n.id));

  return {
    target_node: nodeId,
    direct_dependents: direct,
    transitive_dependents: transitive,
    total_count: all.length,
    queried_at: new Date().toISOString(),
  };
}
