/**
 * query-builder.ts — Fluent Query API
 *
 * Wraps the GraphEngine in a chainable query interface so agents can
 * compose graph queries without knowing traversal internals.
 *
 * Example:
 *   const results = await engine
 *     .from("auth-middleware")
 *     .findDependents()
 *     .withDepth(3)
 *     .includingFeatures()
 *     .execute();
 */

import { GraphEngine } from "./graph-engine.js";
import type { GraphNode, FeatureCoverage, BlastRadius } from "../schemas/graph-schema.js";

type QueryMode =
  | "dependents"
  | "dependencies"
  | "blast-radius"
  | "orphans"
  | "feature-coverage"
  | "cycles"
  | "stats";

interface QueryOptions {
  startNodeId?: string;
  featureId?: string;
  maxDepth?: number;
  includeFeatures?: boolean;
  verifiedOnly?: boolean;
}

export interface QueryResult {
  mode: QueryMode;
  startNodeId?: string;
  nodes?: GraphNode[];
  blastRadius?: BlastRadius;
  featureCoverage?: FeatureCoverage;
  cycles?: Array<{ nodes: string[]; length: number }>;
  stats?: ReturnType<GraphEngine["getStats"]>;
  meta: {
    total: number;
    executed_at: string;
  };
}

// ── Query Builder ──────────────────────────────────────────────────────────

export class QueryBuilder {
  private mode: QueryMode = "dependents";
  private options: QueryOptions = {};

  constructor(private engine: GraphEngine) {}

  /** Set the starting node for traversal queries. */
  from(nodeId: string): this {
    this.options.startNodeId = nodeId;
    return this;
  }

  /** Set the feature ID for feature-coverage queries. */
  forFeature(featureId: string): this {
    this.options.featureId = featureId;
    return this;
  }

  /** Find all nodes that depend on the start node. */
  findDependents(): this {
    this.mode = "dependents";
    return this;
  }

  /** Find all nodes the start node depends on. */
  findDependencies(): this {
    this.mode = "dependencies";
    return this;
  }

  /** Compute the blast radius of changing the start node. */
  blastRadius(): this {
    this.mode = "blast-radius";
    return this;
  }

  /** Find all orphan nodes. */
  findOrphans(): this {
    this.mode = "orphans";
    return this;
  }

  /** Check feature coverage for the given feature ID. */
  featureCoverage(): this {
    this.mode = "feature-coverage";
    return this;
  }

  /** Detect all circular dependencies. */
  detectCycles(): this {
    this.mode = "cycles";
    return this;
  }

  /** Get overall graph statistics. */
  getStats(): this {
    this.mode = "stats";
    return this;
  }

  /** Limit traversal depth (applies to dependents/dependencies). */
  withDepth(depth: number): this {
    this.options.maxDepth = depth;
    return this;
  }

  /** Include feature associations in traversal results. */
  includingFeatures(): this {
    this.options.includeFeatures = true;
    return this;
  }

  /** Filter results to verified nodes only. */
  verifiedOnly(): this {
    this.options.verifiedOnly = true;
    return this;
  }

  /** Execute the built query and return structured results. */
  execute(): QueryResult {
    const executedAt = new Date().toISOString();
    const base: QueryResult = {
      mode: this.mode,
      startNodeId: this.options.startNodeId,
      meta: { total: 0, executed_at: executedAt },
    };

    switch (this.mode) {
      case "dependents": {
        const nodeId = this.options.startNodeId!;
        let nodes = this.engine.getDependents(nodeId);
        if (this.options.verifiedOnly) nodes = nodes.filter((n) => n.verified);
        return { ...base, nodes, meta: { total: nodes.length, executed_at: executedAt } };
      }

      case "dependencies": {
        const nodeId = this.options.startNodeId!;
        let nodes = this.engine.bfs(nodeId, this.options.maxDepth);
        if (this.options.verifiedOnly) nodes = nodes.filter((n) => n.verified);
        return { ...base, nodes, meta: { total: nodes.length, executed_at: executedAt } };
      }

      case "blast-radius": {
        const br = this.engine.getBlastRadius(this.options.startNodeId!);
        const total =
          br.directly_affected.length + br.transitively_affected.length;
        return { ...base, blastRadius: br, meta: { total, executed_at: executedAt } };
      }

      case "orphans": {
        let nodes = this.engine.findOrphans();
        if (this.options.verifiedOnly) nodes = nodes.filter((n) => n.verified);
        return { ...base, nodes, meta: { total: nodes.length, executed_at: executedAt } };
      }

      case "feature-coverage": {
        const fc = this.engine.getFeatureCoverage(this.options.featureId!);
        return {
          ...base,
          featureCoverage: fc,
          meta: { total: fc.implementing_nodes.length, executed_at: executedAt },
        };
      }

      case "cycles": {
        const cycles = this.engine.detectCycles();
        return { ...base, cycles, meta: { total: cycles.length, executed_at: executedAt } };
      }

      case "stats": {
        const stats = this.engine.getStats();
        return { ...base, stats, meta: { total: stats.total_nodes, executed_at: executedAt } };
      }

      default:
        return base;
    }
  }
}

/**
 * Factory function: create a QueryBuilder from a loaded GraphEngine.
 */
export function createQuery(engine: GraphEngine): QueryBuilder {
  return new QueryBuilder(engine);
}
