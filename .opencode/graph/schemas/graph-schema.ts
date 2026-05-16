// graph-schema.ts — TypeScript types for the OAC Graph Reasoning Layer
//
// These types describe the shape of nodes, edges, and query results
// operated on by graph-engine.ts. They extend (but never replace) the
// existing architecture-graph.json data model.

// ── Core Graph Structures ──────────────────────────────────────────────────

export interface GraphNode {
  id: string;
  label: string;
  type: "module" | "service" | "component" | "utility" | "config" | "test" | "unknown";
  path?: string;
  layer?: string;
  verified: boolean;
  metadata?: Record<string, unknown>;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: "imports" | "depends-on" | "extends" | "implements" | "calls" | "configures";
  weight?: number;
  verified: boolean;
}

// ── Pre-computed Indices (written into architecture-graph.json) ────────────

export interface RelationshipIndex {
  [nodeId: string]: {
    dependents: string[];       // nodes that import/use this node
    dependencies: string[];     // nodes this node imports/uses
    feature_associations: string[];
    package_associations: string[];
  };
}

export interface CrossRegistryLink {
  type: "feature_to_node" | "package_to_node" | "feature_to_package";
  feature_id?: string;
  node_id?: string;
  package_name?: string;
  verified: boolean;
}

export interface ArchitectureGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  patterns?: Record<string, unknown>;
  consistency_score?: number;
  relationship_index?: RelationshipIndex;
  cross_registry_links?: CrossRegistryLink[];
}

// ── Query Results ──────────────────────────────────────────────────────────

export type BlastRadiusSeverity = "low" | "medium" | "high" | "critical";

export interface BlastRadius {
  node: GraphNode;
  directly_affected: GraphNode[];
  transitively_affected: GraphNode[];
  affected_features: string[];
  affected_packages: string[];
  severity: BlastRadiusSeverity;
  confidence: number;
  recommendation: string;
}

export interface FeatureCoverage {
  feature_id: string;
  implementing_nodes: GraphNode[];
  coverage_status: "complete" | "partial" | "missing";
  confidence: number;
  gaps: string[];
}

export interface Cycle {
  nodes: string[];   // ordered list of node IDs forming the cycle
  length: number;
}

export interface GraphStats {
  total_nodes: number;
  total_edges: number;
  orphan_count: number;
  cycle_count: number;
  verified_nodes: number;
  average_connectivity: number;
  most_connected_nodes: Array<{ id: string; connection_count: number }>;
}
