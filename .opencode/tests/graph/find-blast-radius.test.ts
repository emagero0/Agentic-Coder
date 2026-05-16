/**
 * find-blast-radius.test.ts — Unit tests for the blast radius query wrapper
 *
 * Tests findBlastRadius() which delegates to ImpactAnalyzer via GraphEngine.
 */
import { describe, it, expect, vi } from "vitest";
import type { GraphNode, BlastRadius } from "../../graph/schemas/graph-schema.js";
import type { GraphEngine } from "../../graph/engine/graph-engine.js";
import { findBlastRadius } from "../../graph/queries/find-blast-radius.js";

function createMockEngine(): GraphEngine {
  const mockNode: GraphNode = { id: "api-gateway", label: "API Gateway", type: "module", verified: true };

  return {
    getBlastRadius: vi.fn((nodeId: string): BlastRadius => {
      if (nodeId === "api-gateway") {
        return {
          node: mockNode,
          directly_affected: [
            { id: "auth-service", label: "Auth", type: "service", verified: true },
          ],
          transitively_affected: [
            { id: "user-service", label: "Users", type: "service", verified: true },
          ],
          affected_features: ["authentication", "user-management"],
          affected_packages: [],
          severity: "critical",
          confidence: 0.9,
          recommendation: "High-risk change. 3 nodes affected. Review before modifying.",
        };
      }
      throw new Error(`Node not found: "${nodeId}"`);
    }),
  } as unknown as GraphEngine;
}

describe("findBlastRadius", () => {
  it("should return a BlastRadiusResult for a valid node", async () => {
    const engine = createMockEngine();
    const result = await findBlastRadius(engine, "api-gateway");

    expect(result.report).toBeDefined();
    expect(result.report.node_id).toBe("api-gateway");
    expect(result.report.blast_radius.severity).toBe("critical");
    expect(result.report.summary).toContain("affects 1 direct and 1 transitive node(s)");
  });

  it("should include formatted text in the report", async () => {
    const engine = createMockEngine();
    const result = await findBlastRadius(engine, "api-gateway");

    expect(result.report.formatted).toBeTruthy();
    expect(result.report.formatted).toContain("Blast Radius:");
    expect(result.report.formatted).toContain("api-gateway");
  });

  it("should include generated_at timestamp", async () => {
    const engine = createMockEngine();
    const result = await findBlastRadius(engine, "api-gateway");

    expect(result.queried_at).toBeTruthy();
    expect(() => new Date(result.queried_at)).not.toThrow();
  });

  it("should include summary string in report", async () => {
    const engine = createMockEngine();
    const result = await findBlastRadius(engine, "api-gateway");

    expect(typeof result.report.summary).toBe("string");
    expect(result.report.summary.length).toBeGreaterThan(0);
  });

  it("should throw for non-existent node", async () => {
    const engine = createMockEngine();
    await expect(findBlastRadius(engine, "nonexistent")).rejects.toThrow("Node not found");
  });
});
