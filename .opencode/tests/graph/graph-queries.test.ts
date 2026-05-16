/**
 * graph-queries.test.ts — Unit tests for graph query wrapper functions
 *
 * Tests findOrphans, findFeatureCoverage, findDependents, and findBlastRadius
 * by providing mock GraphEngine instances.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { GraphNode, BlastRadius, FeatureCoverage } from "../../graph/schemas/graph-schema.js";
import type { GraphEngine } from "../../graph/engine/graph-engine.js";

// Since the query modules import the actual GraphEngine but only call methods on it,
// we can provide any object that matches the method signatures.

import { findOrphans } from "../../graph/queries/find-orphans.js";
import { findFeatureCoverage } from "../../graph/queries/find-feature-coverage.js";
import { findDependents } from "../../graph/queries/find-dependents.js";

// ── Mock GraphEngine ─────────────────────────────────────────────────────────

function createMockEngine(): GraphEngine {
  const mockNode: GraphNode = { id: "test-node", label: "Test", type: "module", verified: true };
  const mockUnverifiedNode: GraphNode = { id: "unverified", label: "Unverified", type: "unknown", verified: false };

  return {
    findOrphans: vi.fn().mockReturnValue([mockUnverifiedNode]),
    getFeatureCoverage: vi.fn((featureId: string): FeatureCoverage => ({
      feature_id: featureId,
      implementing_nodes: featureId === "known-feature" ? [mockNode] : [],
      coverage_status: featureId === "known-feature" ? "complete" : "missing",
      confidence: featureId === "known-feature" ? 0.9 : 0.3,
      gaps: featureId === "known-feature" ? [] : ["No architecture nodes found for this feature"],
    })),
    getBlastRadius: vi.fn((nodeId: string): BlastRadius => ({
      node: mockNode,
      directly_affected: nodeId === "impacted" ? [mockNode] : [],
      transitively_affected: [],
      affected_features: [],
      affected_packages: [],
      severity: nodeId === "impacted" ? "high" : "low",
      confidence: 0.8,
      recommendation: "Proceed with standard review.",
    })),
    getDependents: vi.fn((nodeId: string): GraphNode[] =>
      nodeId === "impacted" ? [mockNode, { ...mockNode, id: "transitive-dep" }] : []
    ),
  } as unknown as GraphEngine;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("findOrphans", () => {
  let engine: GraphEngine;

  beforeEach(() => {
    engine = createMockEngine();
  });

  it("should detect orphans and categorize by verification status", () => {
    const result = findOrphans(engine);
    expect(result.count).toBeGreaterThan(0);
    expect(result.unverified_orphans).toBe(1);
    expect(result.verified_orphans).toBe(0);
  });

  it("should generate appropriate recommendation for unverified orphans", () => {
    const result = findOrphans(engine);
    expect(result.recommendation).toContain("unverified orphan");
  });

  it("should include queried_at timestamp", () => {
    const result = findOrphans(engine);
    expect(result.queried_at).toBeTruthy();
    expect(() => new Date(result.queried_at)).not.toThrow();
  });

  it("should delegate to engine.findOrphans", () => {
    findOrphans(engine);
    expect(engine.findOrphans).toHaveBeenCalledTimes(1);
  });
});

describe("findFeatureCoverage", () => {
  let engine: GraphEngine;

  beforeEach(() => {
    engine = createMockEngine();
  });

  it("should return complete coverage for a known feature", () => {
    const result = findFeatureCoverage(engine, "known-feature");
    expect(result.coverage.coverage_status).toBe("complete");
    expect(result.coverage.confidence).toBe(0.9);
  });

  it("should return missing coverage for an unknown feature", () => {
    const result = findFeatureCoverage(engine, "unknown-feature");
    expect(result.coverage.coverage_status).toBe("missing");
    expect(result.coverage.gaps.length).toBeGreaterThan(0);
  });

  it("should generate a formatted summary", () => {
    const result = findFeatureCoverage(engine, "known-feature");
    expect(result.formatted_summary).toContain("known-feature");
    expect(result.formatted_summary).toContain("COMPLETE");
  });

  it("should include verified status in formatted output", () => {
    const result = findFeatureCoverage(engine, "known-feature");
    expect(result.formatted_summary).toContain("✓");
  });

  it("should include queried_at timestamp", () => {
    const result = findFeatureCoverage(engine, "known-feature");
    expect(result.queried_at).toBeTruthy();
  });
});

describe("findDependents", () => {
  let engine: GraphEngine;

  beforeEach(() => {
    engine = createMockEngine();
  });

  it("should return dependents for an impacted node", () => {
    const result = findDependents(engine, "impacted");
    expect(result.target_node).toBe("impacted");
    expect(result.total_count).toBe(2);
    expect(result.direct_dependents.length).toBeGreaterThan(0);
  });

  it("should return 0 dependents for an unimpacted node", () => {
    const result = findDependents(engine, "isolated");
    expect(result.total_count).toBe(0);
  });

  it("should separate direct and transitive dependents", () => {
    const result = findDependents(engine, "impacted");
    expect(result.direct_dependents.length + result.transitive_dependents.length).toBe(result.total_count);
  });

  it("should include queried_at timestamp", () => {
    const result = findDependents(engine, "impacted");
    expect(result.queried_at).toBeTruthy();
  });
});
