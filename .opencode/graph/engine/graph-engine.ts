/**
 * graph-engine.ts — Core Graph Traversal Engine
 *
 * Implements BFS, DFS, cycle detection, topological sort, and subgraph
 * extraction over the verified architecture-graph.json.
 *
 * Design constraints:
 *   - Read-only: never writes to state files
 *   - No external dependencies beyond Node.js built-ins
 *   - All algorithms operate on in-memory adjacency maps built at load time
 */

import * as fs from "fs";
import * as path from "path";
import type {
  ArchitectureGraph,
  GraphNode,
  GraphEdge,
  BlastRadius,
  BlastRadiusSeverity,
  FeatureCoverage,
  Cycle,
  GraphStats,
  RelationshipIndex,
} from "../schemas/graph-schema.js";

// ── Internal Adjacency Map ─────────────────────────────────────────────────

type AdjacencyMap = Map<string, Set<string>>;

function buildAdjacency(edges: GraphEdge[]): {
  outbound: AdjacencyMap;
  inbound: AdjacencyMap;
} {
  const outbound: AdjacencyMap = new Map();
  const inbound: AdjacencyMap = new Map();

  for (const edge of edges) {
    if (!outbound.has(edge.source)) outbound.set(edge.source, new Set());
    if (!inbound.has(edge.target)) inbound.set(edge.target, new Set());

    outbound.get(edge.source)!.add(edge.target);
    inbound.get(edge.target)!.add(edge.source);
  }

  return { outbound, inbound };
}

// ── Severity Classification ────────────────────────────────────────────────

function classifySeverity(
  directCount: number,
  transitiveCount: number,
  affectedFeatures: number
): BlastRadiusSeverity {
  const total = directCount + transitiveCount;
  if (total >= 10 || affectedFeatures >= 3) return "critical";
  if (total >= 6 || affectedFeatures >= 2) return "high";
  if (total >= 3 || affectedFeatures >= 1) return "medium";
  return "low";
}

// ── Graph Engine ───────────────────────────────────────────────────────────

export class GraphEngine {
  private graph: ArchitectureGraph | null = null;
  private nodeMap: Map<string, GraphNode> = new Map();
  private outbound: AdjacencyMap = new Map();
  private inbound: AdjacencyMap = new Map();

  /**
   * Load the architecture graph from the state file.
   */
  async load(graphPath: string): Promise<void> {
    const resolved = path.resolve(graphPath);
    if (!fs.existsSync(resolved)) {
      throw new Error(`[GraphEngine] Graph file not found: ${resolved}`);
    }

    const raw = fs.readFileSync(resolved, "utf-8");
    this.graph = JSON.parse(raw) as ArchitectureGraph;

    // Build in-memory indices
    this.nodeMap = new Map(this.graph.nodes.map((n) => [n.id, n]));
    const adj = buildAdjacency(this.graph.edges);
    this.outbound = adj.outbound;
    this.inbound = adj.inbound;
  }

  private requireLoaded(): void {
    if (!this.graph) throw new Error("[GraphEngine] Graph not loaded. Call load() first.");
  }

  private resolveNode(nodeId: string): GraphNode {
    const node = this.nodeMap.get(nodeId);
    if (!node) throw new Error(`[GraphEngine] Node not found: "${nodeId}"`);
    return node;
  }

  // ── Traversal ────────────────────────────────────────────────────────────

  /**
   * Breadth-first traversal from startNodeId.
   * Returns all reachable nodes within maxDepth hops (following outbound edges).
   */
  bfs(startNodeId: string, maxDepth = Infinity): GraphNode[] {
    this.requireLoaded();
    const visited = new Set<string>();
    const queue: Array<{ id: string; depth: number }> = [{ id: startNodeId, depth: 0 }];
    const result: GraphNode[] = [];

    while (queue.length > 0) {
      const { id, depth } = queue.shift()!;
      if (visited.has(id) || depth > maxDepth) continue;
      visited.add(id);

      const node = this.nodeMap.get(id);
      if (node && id !== startNodeId) result.push(node);

      for (const neighbor of this.outbound.get(id) ?? []) {
        if (!visited.has(neighbor)) {
          queue.push({ id: neighbor, depth: depth + 1 });
        }
      }
    }

    return result;
  }

  /**
   * Depth-first traversal from startNodeId (following outbound edges).
   */
  dfs(startNodeId: string): GraphNode[] {
    this.requireLoaded();
    const visited = new Set<string>();
    const result: GraphNode[] = [];

    const visit = (id: string): void => {
      if (visited.has(id)) return;
      visited.add(id);
      for (const neighbor of this.outbound.get(id) ?? []) {
        visit(neighbor);
      }
      const node = this.nodeMap.get(id);
      if (node && id !== startNodeId) result.push(node);
    };

    visit(startNodeId);
    return result;
  }

  // ── Queries ───────────────────────────────────────────────────────────────

  /**
   * Returns all nodes that directly or transitively depend on nodeId.
   */
  getDependents(nodeId: string): GraphNode[] {
    this.requireLoaded();
    const visited = new Set<string>();
    const result: GraphNode[] = [];
    const queue = [nodeId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const dep of this.inbound.get(current) ?? []) {
        if (!visited.has(dep)) {
          visited.add(dep);
          const node = this.nodeMap.get(dep);
          if (node) result.push(node);
          queue.push(dep);
        }
      }
    }

    return result;
  }

  /**
   * Returns all nodes that nodeId directly or transitively depends on.
   */
  getDependencies(nodeId: string): GraphNode[] {
    this.requireLoaded();
    return this.bfs(nodeId);
  }

  /**
   * Computes the blast radius: what breaks if nodeId changes?
   */
  getBlastRadius(nodeId: string): BlastRadius {
    this.requireLoaded();
    const node = this.resolveNode(nodeId);

    const directly: GraphNode[] = [];
    for (const id of this.inbound.get(nodeId) ?? []) {
      const n = this.nodeMap.get(id);
      if (n) directly.push(n);
    }

    const visited = new Set<string>([nodeId, ...directly.map((n) => n.id)]);
    const transitively: GraphNode[] = [];
    const queue = directly.map((n) => n.id);

    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const dep of this.inbound.get(current) ?? []) {
        if (!visited.has(dep)) {
          visited.add(dep);
          const n = this.nodeMap.get(dep);
          if (n) {
            transitively.push(n);
            queue.push(dep);
          }
        }
      }
    }

    // Cross-registry: find affected features
    const affectedFeatures = (this.graph!.cross_registry_links ?? [])
      .filter(
        (link) =>
          link.type === "feature_to_node" &&
          link.node_id &&
          visited.has(link.node_id) &&
          link.feature_id
      )
      .map((link) => link.feature_id!);

    const uniqueFeatures = [...new Set(affectedFeatures)];
    const severity = classifySeverity(
      directly.length,
      transitively.length,
      uniqueFeatures.length
    );

    return {
      node,
      directly_affected: directly,
      transitively_affected: transitively,
      affected_features: uniqueFeatures,
      affected_packages: [],
      severity,
      confidence: node.verified ? 0.9 : 0.6,
      recommendation:
        severity === "critical" || severity === "high"
          ? `High-risk change. ${directly.length + transitively.length} nodes affected. Review all dependents before modifying.`
          : `Low-risk change. Proceed with standard review.`,
    };
  }

  /**
   * Finds all orphan nodes (no inbound AND no outbound edges).
   */
  findOrphans(): GraphNode[] {
    this.requireLoaded();
    return this.graph!.nodes.filter(
      (node) =>
        !this.outbound.has(node.id) &&
        !this.inbound.has(node.id)
    );
  }

  /**
   * Detects cycles in the graph using DFS.
   */
  detectCycles(): Cycle[] {
    this.requireLoaded();
    const visited = new Set<string>();
    const inStack = new Set<string>();
    const cycles: Cycle[] = [];

    const dfs = (id: string, path: string[]): void => {
      if (inStack.has(id)) {
        const cycleStart = path.indexOf(id);
        if (cycleStart !== -1) {
          cycles.push({ nodes: path.slice(cycleStart), length: path.length - cycleStart });
        }
        return;
      }
      if (visited.has(id)) return;

      visited.add(id);
      inStack.add(id);

      for (const neighbor of this.outbound.get(id) ?? []) {
        dfs(neighbor, [...path, id]);
      }

      inStack.delete(id);
    };

    for (const node of this.graph!.nodes) {
      dfs(node.id, []);
    }

    return cycles;
  }

  // ── Cross-Registry ─────────────────────────────────────────────────────────

  /**
   * Returns all graph nodes that implement the given verified feature.
   */
  getFeatureCoverage(featureId: string): FeatureCoverage {
    this.requireLoaded();
    const links = (this.graph!.cross_registry_links ?? []).filter(
      (l) => l.type === "feature_to_node" && l.feature_id === featureId
    );

    const implementingNodes: GraphNode[] = [];
    for (const link of links) {
      if (link.node_id) {
        const node = this.nodeMap.get(link.node_id);
        if (node) implementingNodes.push(node);
      }
    }

    const status =
      implementingNodes.length === 0
        ? "missing"
        : implementingNodes.every((n) => n.verified)
        ? "complete"
        : "partial";

    return {
      feature_id: featureId,
      implementing_nodes: implementingNodes,
      coverage_status: status,
      confidence: status === "complete" ? 0.9 : status === "partial" ? 0.6 : 0.3,
      gaps: status === "missing" ? ["No architecture nodes found for this feature"] : [],
    };
  }

  /**
   * Returns overall graph statistics.
   */
  getStats(): GraphStats {
    this.requireLoaded();
    const orphans = this.findOrphans();
    const cycles = this.detectCycles();

    const connectionCounts = this.graph!.nodes.map((node) => ({
      id: node.id,
      connection_count:
        (this.outbound.get(node.id)?.size ?? 0) +
        (this.inbound.get(node.id)?.size ?? 0),
    }));

    const totalConnections = connectionCounts.reduce((sum, n) => sum + n.connection_count, 0);
    const avgConnectivity =
      this.graph!.nodes.length > 0
        ? totalConnections / this.graph!.nodes.length
        : 0;

    const mostConnected = [...connectionCounts]
      .sort((a, b) => b.connection_count - a.connection_count)
      .slice(0, 5);

    return {
      total_nodes: this.graph!.nodes.length,
      total_edges: this.graph!.edges.length,
      orphan_count: orphans.length,
      cycle_count: cycles.length,
      verified_nodes: this.graph!.nodes.filter((n) => n.verified).length,
      average_connectivity: Math.round(avgConnectivity * 100) / 100,
      most_connected_nodes: mostConnected,
    };
  }

  /**
   * Build or refresh the relationship_index in the graph data.
   * Returns the updated index without writing to disk.
   */
  buildRelationshipIndex(): RelationshipIndex {
    this.requireLoaded();
    const index: RelationshipIndex = {};

    for (const node of this.graph!.nodes) {
      index[node.id] = {
        dependents: [...(this.inbound.get(node.id) ?? [])],
        dependencies: [...(this.outbound.get(node.id) ?? [])],
        feature_associations: (this.graph!.cross_registry_links ?? [])
          .filter((l) => l.node_id === node.id && l.feature_id)
          .map((l) => l.feature_id!),
        package_associations: (this.graph!.cross_registry_links ?? [])
          .filter((l) => l.node_id === node.id && l.package_name)
          .map((l) => l.package_name!),
      };
    }

    return index;
  }
}
