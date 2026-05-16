/**
 * query-builder.test.ts — Unit tests for the fluent QueryBuilder API
 *
 * Tests the chainable query interface (from().findDependents().withDepth().execute())
 * by providing a mock GraphEngine.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { GraphNode, BlastRadius, FeatureCoverage } from "../../graph/schemas/graph-schema.js";
import type { GraphEngine } from "../../graph/engine/graph-engine.js";
import { QueryBuilder, createQuery } from "../../graph/engine/query-builder.js";

function createMockEngine(): GraphEngine {
  const mockNode: GraphNode = { id: "test-node", label: "Test", type: "module", verified: true };
  const mockUnverified: GraphNode = { id: "unverified", label: "Unv", type: "unknown", verified: false };

  return {
    getDependents: vi.fn((id: string): GraphNode[] =>
      id === "core" ? [mockNode, { ...mockNode, id: "dep-a" }] : []
    ),
    bfs: vi.fn((id: string): GraphNode[] =>
      id === "core" ? [mockNode, { ...mockNode, id: "dep-a" }] : []
    ),
    getBlastRadius: vi.fn((id: string): BlastRadius => ({
      node: { ...mockNode, id },
      directly_affected: id === "core" ? [mockNode] : [],
      transitively_affected: id === "core" ? [{ ...mockNode, id: "transitive" }] : [],
      affected_features: [],
      affected_packages: [],
      severity: id === "core" ? "high" : "low",
      confidence: 0.8,
      recommendation: "Standard review.",
    })),
    findOrphans: vi.fn((): GraphNode[] => [mockUnverified]),
    getFeatureCoverage: vi.fn((fid: string): FeatureCoverage => ({
      feature_id: fid,
      implementing_nodes: fid === "known" ? [mockNode] : [],
      coverage_status: fid === "known" ? "complete" : "missing",
      confidence: fid === "known" ? 0.9 : 0.3,
      gaps: fid === "known" ? [] : ["No nodes found"],
    })),
    detectCycles: vi.fn((): Array<{ nodes: string[]; length: number }> => []),
    getStats: vi.fn(() => ({
      total_nodes: 5,
      total_edges: 6,
      orphan_count: 1,
      cycle_count: 0,
      verified_nodes: 4,
      average_connectivity: 2.4,
      most_connected_nodes: [{ id: "core", connection_count: 3 }],
    })),
  } as unknown as GraphEngine;
}

describe("QueryBuilder", () => {
  let engine: GraphEngine;

  beforeEach(() => {
    engine = createMockEngine();
  });

  describe("fluent API", () => {
    it("should support method chaining", () => {
      const qb = new QueryBuilder(engine)
        .from("core")
        .findDependents()
        .withDepth(3)
        .includingFeatures()
        .verifiedOnly();
      expect(qb).toBeInstanceOf(QueryBuilder);
    });

    it("should set mode via findDependents", () => {
      const qb = new QueryBuilder(engine).findDependents();
      expect((qb as any).mode).toBe("dependents");
    });

    it("should set mode via findDependencies", () => {
      const qb = new QueryBuilder(engine).findDependencies();
      expect((qb as any).mode).toBe("dependencies");
    });

    it("should set mode via blastRadius", () => {
      const qb = new QueryBuilder(engine).blastRadius();
      expect((qb as any).mode).toBe("blast-radius");
    });

    it("should set mode via findOrphans", () => {
      const qb = new QueryBuilder(engine).findOrphans();
      expect((qb as any).mode).toBe("orphans");
    });

    it("should set mode via featureCoverage", () => {
      const qb = new QueryBuilder(engine).featureCoverage();
      expect((qb as any).mode).toBe("feature-coverage");
    });

    it("should set mode via detectCycles", () => {
      const qb = new QueryBuilder(engine).detectCycles();
      expect((qb as any).mode).toBe("cycles");
    });

    it("should set mode via getStats", () => {
      const qb = new QueryBuilder(engine).getStats();
      expect((qb as any).mode).toBe("stats");
    });

    it("should set options via from()", () => {
      const qb = new QueryBuilder(engine).from("my-node");
      expect((qb as any).options.startNodeId).toBe("my-node");
    });

    it("should set options via forFeature()", () => {
      const qb = new QueryBuilder(engine).forFeature("my-feature");
      expect((qb as any).options.featureId).toBe("my-feature");
    });

    it("should set options via withDepth()", () => {
      const qb = new QueryBuilder(engine).withDepth(5);
      expect((qb as any).options.maxDepth).toBe(5);
    });
  });

  describe("execute", () => {
    it("should execute dependents query", () => {
      const result = new QueryBuilder(engine)
        .from("core")
        .findDependents()
        .execute();
      expect(result.mode).toBe("dependents");
      expect(result.nodes).toHaveLength(2);
      expect(result.meta.total).toBe(2);
    });

    it("should execute dependents query with verifiedOnly filter", () => {
      const result = new QueryBuilder(engine)
        .from("core")
        .findDependents()
        .verifiedOnly()
        .execute();
      expect(result.mode).toBe("dependents");
      expect(result.nodes).toBeDefined();
      expect(engine.getDependents).toHaveBeenCalled();
    });

    it("should execute dependencies query (bfs)", () => {
      const result = new QueryBuilder(engine)
        .from("core")
        .findDependencies()
        .execute();
      expect(result.mode).toBe("dependencies");
      expect(result.nodes).toHaveLength(2);
    });

    it("should execute blast-radius query", () => {
      const result = new QueryBuilder(engine)
        .from("core")
        .blastRadius()
        .execute();
      expect(result.mode).toBe("blast-radius");
      expect(result.blastRadius).toBeDefined();
      expect(result.blastRadius!.severity).toBe("high");
      expect(result.meta.total).toBe(2);
    });

    it("should execute orphans query", () => {
      const result = new QueryBuilder(engine)
        .findOrphans()
        .execute();
      expect(result.mode).toBe("orphans");
      expect(result.nodes).toHaveLength(1);
    });

    it("should execute feature-coverage query", () => {
      const result = new QueryBuilder(engine)
        .forFeature("known")
        .featureCoverage()
        .execute();
      expect(result.mode).toBe("feature-coverage");
      expect(result.featureCoverage).toBeDefined();
      expect(result.featureCoverage!.coverage_status).toBe("complete");
    });

    it("should execute cycles query", () => {
      const result = new QueryBuilder(engine)
        .detectCycles()
        .execute();
      expect(result.mode).toBe("cycles");
      expect(result.cycles).toBeDefined();
      expect(result.meta.total).toBe(0);
    });

    it("should execute stats query", () => {
      const result = new QueryBuilder(engine)
        .getStats()
        .execute();
      expect(result.mode).toBe("stats");
      expect(result.stats).toBeDefined();
      expect(result.stats!.total_nodes).toBe(5);
      expect(result.stats!.orphan_count).toBe(1);
    });

    it("should return base result for default case", () => {
      const qb = new QueryBuilder(engine);
      (qb as any).mode = "unknown-mode" as any;
      const result = qb.execute();
      expect(result.mode).toBe("unknown-mode" as any);
      expect(result.meta.total).toBe(0);
    });
  });
});

describe("createQuery factory", () => {
  it("should create a QueryBuilder from engine", () => {
    const engine = createMockEngine();
    const qb = createQuery(engine);
    expect(qb).toBeInstanceOf(QueryBuilder);
  });

  it("should support chaining from factory", () => {
    const engine = createMockEngine();
    const result = createQuery(engine)
      .from("core")
      .findDependents()
      .execute();
    expect(result.meta.total).toBeGreaterThanOrEqual(0);
  });
});
