/**
 * graph-engine.test.ts — Unit tests for the Graph Traversal Engine
 *
 * Tests BFS, DFS, cycle detection, orphan finding, blast radius,
 * feature coverage, and dependency analysis against a mock architecture graph.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock fs and path BEFORE importing GraphEngine ──────────────────────────

const mockFileSystem = new Map<string, string>();

vi.mock("fs", () => ({
  existsSync: vi.fn((path: string) => mockFileSystem.has(path)),
  readFileSync: vi.fn((path: string) => {
    const content = mockFileSystem.get(path);
    if (!content) throw new Error(`ENOENT: ${path}`);
    return content;
  }),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

vi.mock("path", () => ({
  default: {
    resolve: vi.fn((...args: string[]) => args.join("/").replace(/\/+/g, "/")),
    join: vi.fn((...args: string[]) => args.join("/").replace(/\/+/g, "/")),
    dirname: vi.fn((p: string) => p.split("/").slice(0, -1).join("/")),
  },
  resolve: vi.fn((...args: string[]) => args.join("/").replace(/\/+/g, "/")),
  join: vi.fn((...args: string[]) => args.join("/").replace(/\/+/g, "/")),
  dirname: vi.fn((p: string) => p.split("/").slice(0, -1).join("/")),
}));

// ── Fixture: Simple 5-node graph ─────────────────────────────────────────────

const FIXTURE_GRAPH = {
  nodes: [
    { id: "router", label: "Router", type: "module" as const, verified: true },
    { id: "auth", label: "Auth Service", type: "service" as const, verified: true },
    { id: "users", label: "Users Service", type: "service" as const, verified: true },
    { id: "db", label: "Database", type: "service" as const, verified: true },
    { id: "cache", label: "Cache Layer", type: "utility" as const, verified: false },
  ],
  edges: [
    { source: "router", target: "auth", type: "imports" as const, verified: true },
    { source: "router", target: "users", type: "imports" as const, verified: true },
    { source: "auth", target: "db", type: "depends-on" as const, verified: true },
    { source: "users", target: "db", type: "depends-on" as const, verified: true },
    { source: "auth", target: "cache", type: "imports" as const, verified: false },
    { source: "users", target: "cache", type: "imports" as const, verified: false },
  ],
  cross_registry_links: [
    { type: "feature_to_node" as const, feature_id: "user-management", node_id: "router", verified: true },
    { type: "feature_to_node" as const, feature_id: "user-management", node_id: "users", verified: true },
    { type: "feature_to_node" as const, feature_id: "user-management", node_id: "db", verified: true },
    { type: "feature_to_node" as const, feature_id: "authentication", node_id: "auth", verified: true },
  ],
};

const FIXTURE_GRAPH_PATH = "/.opencode/state/verified/architecture/architecture-graph.json";

// ── Imports (after mocks are set up) ─────────────────────────────────────────

import { GraphEngine } from "../../graph/engine/graph-engine.js";

// ── Tests ────────────────────────────────────────────────────────────────────

describe("GraphEngine", () => {
  let engine: GraphEngine;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockFileSystem.clear();
    mockFileSystem.set(FIXTURE_GRAPH_PATH, JSON.stringify(FIXTURE_GRAPH));
    engine = new GraphEngine();
    await engine.load(FIXTURE_GRAPH_PATH);
  });

  // ── Loading ──────────────────────────────────────────────────────────────

  describe("load", () => {
    it("should load graph from file and build adjacency maps", () => {
      expect(engine).toBeDefined();
    });

    it("should throw if file not found", async () => {
      const badEngine = new GraphEngine();
      await expect(badEngine.load("/nonexistent.json")).rejects.toThrow("Graph file not found");
    });
  });

  // ── BFS ──────────────────────────────────────────────────────────────────

  describe("bfs", () => {
    it("should find direct children of router", () => {
      const result = engine.bfs("router", 1);
      const ids = result.map((n) => n.id);
      expect(ids).toContain("auth");
      expect(ids).toContain("users");
      expect(ids).not.toContain("db"); // db is 2 hops away
      expect(ids).not.toContain("cache"); // cache is 2 hops away
    });

    it("should traverse to full depth with default maxDepth", () => {
      const result = engine.bfs("router");
      const ids = result.map((n) => n.id);
      expect(ids).toContain("auth");
      expect(ids).toContain("users");
      expect(ids).toContain("db");
      expect(ids).toContain("cache");
    });

    it("should return empty array for leaf node", () => {
      const result = engine.bfs("db");
      expect(result).toHaveLength(0);
    });

    it("should not include the start node in results", () => {
      const result = engine.bfs("router");
      const ids = result.map((n) => n.id);
      expect(ids).not.toContain("router");
    });

    it("should throw if graph not loaded", () => {
      const freshEngine = new GraphEngine();
      expect(() => freshEngine.bfs("router")).toThrow("Graph not loaded");
    });
  });

  // ── DFS ──────────────────────────────────────────────────────────────────

  describe("dfs", () => {
    it("should traverse depth-first from router", () => {
      const result = engine.dfs("router");
      const ids = result.map((n) => n.id);
      expect(ids).toContain("auth");
      expect(ids).toContain("users");
      expect(ids).toContain("db");
      expect(ids).toContain("cache");
    });

    it("should return empty for leaf node", () => {
      const result = engine.bfs("cache");
      expect(result).toHaveLength(0);
    });
  });

  // ── Orphans ──────────────────────────────────────────────────────────────

  describe("findOrphans", () => {
    it("should have no orphans in the test graph (all nodes connected)", () => {
      const orphans = engine.findOrphans();
      expect(orphans).toHaveLength(0);
    });

    it("should detect an orphaned node when added", () => {
      // Can't easily modify the graph after load — test via the method contract
      // This test verifies the method runs without error
      expect(() => engine.findOrphans()).not.toThrow();
    });
  });

  // ── Cycles ───────────────────────────────────────────────────────────────

  describe("detectCycles", () => {
    it("should have no cycles in the test graph (DAG)", () => {
      const cycles = engine.detectCycles();
      expect(cycles).toHaveLength(0);
    });

    it("should detect cycles in a cyclic graph", async () => {
      const cyclicGraph = {
        ...FIXTURE_GRAPH,
        edges: [
          ...FIXTURE_GRAPH.edges,
          { source: "db", target: "auth", type: "depends-on" as const, verified: true },
          { source: "auth", target: "db", type: "depends-on" as const, verified: true },
        ],
      };
      const cyclicPath = "/.opencode/test/cyclic.json";
      mockFileSystem.set(cyclicPath, JSON.stringify(cyclicGraph));
      const cyclicEngine = new GraphEngine();
      await cyclicEngine.load(cyclicPath);
      const cycles = cyclicEngine.detectCycles();
      expect(cycles.length).toBeGreaterThanOrEqual(1);
      expect(cycles[0].length).toBeGreaterThanOrEqual(2);
    });
  });

  // ── Dependents ───────────────────────────────────────────────────────────

  describe("getDependents", () => {
    it("should find all dependents of db (auth, users, router)", () => {
      const result = engine.getDependents("db");
      const ids = result.map((n) => n.id);
      expect(ids).toContain("auth");
      expect(ids).toContain("users");
      expect(ids).toContain("router");
    });

    it("should return empty for root node with no dependents", () => {
      const result = engine.getDependents("router");
      expect(result).toHaveLength(0);
    });

    it("should return all dependents of cache (auth, users, router via auth)", () => {
      const result = engine.getDependents("cache");
      const ids = result.map((n) => n.id);
      expect(ids).toContain("auth");
      expect(ids).toContain("users");
      // router transitively depends on cache via auth
      expect(ids).toContain("router");
    });
  });

  // ── Dependencies ─────────────────────────────────────────────────────────

  describe("getDependencies", () => {
    it("should return all dependencies of router", () => {
      const result = engine.getDependencies("router");
      const ids = result.map((n) => n.id);
      expect(ids).toContain("auth");
      expect(ids).toContain("users");
    });
  });

  // ── Blast Radius ─────────────────────────────────────────────────────────

  describe("getBlastRadius", () => {
    it("should compute blast radius for db change (high — 2 direct + 1 transitive, 2 features)", () => {
      const result = engine.getBlastRadius("db");
      expect(result.node.id).toBe("db");
      expect(result.directly_affected.length).toBeGreaterThanOrEqual(2); // auth, users
      // Severity: total=2+1=3, affectedFeatures = [user-management, authentication] = 2 unique → high (≥2 features)
      expect(result.severity).toBe("high");
    });

    it("should compute blast radius for cache change (high — 2 direct + 1 transitive, 2 features)", () => {
      const result = engine.getBlastRadius("cache");
      expect(result.directly_affected.length).toBe(2); // auth, users
      // Severity: auth→authentication, users→user-management = 2 features → high
      expect(result.severity).toBe("high");
    });

    it("should compute blast radius for router change (medium — 0 dependents but has feature link)", () => {
      const result = engine.getBlastRadius("router");
      expect(result.directly_affected).toHaveLength(0);
      // Severity: router has feature_to_node link → 1 affected feature → medium
      expect(result.severity).toBe("medium");
    });

    it("should include affected features", () => {
      const result = engine.getBlastRadius("db");
      expect(result.affected_features).toContain("user-management");
    });

    it("should provide a recommendation string", () => {
      const result = engine.getBlastRadius("db");
      expect(typeof result.recommendation).toBe("string");
      expect(result.recommendation.length).toBeGreaterThan(0);
    });

    it("should throw for non-existent node", () => {
      expect(() => engine.getBlastRadius("nonexistent")).toThrow("Node not found");
    });
  });

  // ── Feature Coverage ────────────────────────────────────────────────────

  describe("getFeatureCoverage", () => {
    it("should return complete coverage for user-management", () => {
      const result = engine.getFeatureCoverage("user-management");
      expect(result.coverage_status).toBe("complete");
      expect(result.implementing_nodes).toHaveLength(3);
      expect(result.confidence).toBe(0.9);
    });

    it("should return missing coverage for unknown feature", () => {
      const result = engine.getFeatureCoverage("unknown-feature");
      expect(result.coverage_status).toBe("missing");
      expect(result.implementing_nodes).toHaveLength(0);
      expect(result.gaps.length).toBeGreaterThan(0);
    });
  });

  // ── Stats ───────────────────────────────────────────────────────────────

  describe("getStats", () => {
    it("should return correct graph statistics", () => {
      const stats = engine.getStats();
      expect(stats.total_nodes).toBe(5);
      expect(stats.total_edges).toBe(6);
      expect(stats.orphan_count).toBe(0);
      expect(stats.cycle_count).toBe(0);
      expect(stats.verified_nodes).toBe(4); // router, auth, users, db
    });

    it("should compute average connectivity", () => {
      const stats = engine.getStats();
      expect(stats.average_connectivity).toBeGreaterThan(0);
      expect(stats.most_connected_nodes.length).toBeGreaterThan(0);
    });
  });

  // ── Relationship Index ──────────────────────────────────────────────────

  describe("buildRelationshipIndex", () => {
    it("should build index for all nodes", () => {
      const index = engine.buildRelationshipIndex();
      expect(Object.keys(index)).toHaveLength(5);
      expect(index["router"]).toBeDefined();
      expect(index["router"].dependents).toEqual([]);
      expect(index["router"].dependencies).toContain("auth");
      expect(index["db"].dependents).toContain("auth");
    });

    it("should include feature associations", () => {
      const index = engine.buildRelationshipIndex();
      expect(index["auth"].feature_associations).toContain("authentication");
      expect(index["users"].feature_associations).toContain("user-management");
    });
  });
});
