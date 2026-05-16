/**
 * impact-analyzer.test.ts — Unit tests for ImpactAnalyzer
 *
 * Tests analyzeNode and analyzeNodes methods with a mock GraphEngine.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { BlastRadius, GraphNode } from "../../graph/schemas/graph-schema.js";
import type { GraphEngine } from "../../graph/engine/graph-engine.js";
import { ImpactAnalyzer } from "../../graph/engine/impact-analyzer.js";

// ── Mock GraphEngine ─────────────────────────────────────────────────────────

function createMockEngine(): GraphEngine {
  const mockNode: GraphNode = { id: "core-module", label: "Core Module", type: "module", verified: true };

  return {
    getBlastRadius: vi.fn((nodeId: string): BlastRadius => {
      if (nodeId === "core-module") {
        return {
          node: mockNode,
          directly_affected: [
            { id: "service-a", label: "Service A", type: "service", verified: true },
            { id: "service-b", label: "Service B", type: "service", verified: true },
          ],
          transitively_affected: [
            { id: "service-c", label: "Service C", type: "service", verified: false },
          ],
          affected_features: ["feature-1"],
          affected_packages: [],
          severity: "high",
          confidence: 0.85,
          recommendation: "High-risk change. 3 nodes affected. Review all dependents before modifying.",
        };
      }
      if (nodeId === "leaf-module") {
        return {
          node: { id: "leaf-module", label: "Leaf Module", type: "utility", verified: true },
          directly_affected: [],
          transitively_affected: [],
          affected_features: [],
          affected_packages: [],
          severity: "low",
          confidence: 0.9,
          recommendation: "Low-risk change. Proceed with standard review.",
        };
      }
      throw new Error(`Node not found: "${nodeId}"`);
    }),
  } as unknown as GraphEngine;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("ImpactAnalyzer", () => {
  let engine: GraphEngine;
  let analyzer: ImpactAnalyzer;

  beforeEach(() => {
    engine = createMockEngine();
    analyzer = new ImpactAnalyzer(engine);
  });

  describe("analyzeNode", () => {
    it("should return a complete ImpactReport for a high-impact node", async () => {
      const report = await analyzer.analyzeNode("core-module");
      expect(report.node_id).toBe("core-module");
      expect(report.blast_radius.severity).toBe("high");
      expect(report.summary).toContain("affects 2 direct and 1 transitive node(s)");
    });

    it("should return a complete ImpactReport for a low-impact node", async () => {
      const report = await analyzer.analyzeNode("leaf-module");
      expect(report.node_id).toBe("leaf-module");
      expect(report.blast_radius.severity).toBe("low");
      expect(report.summary).toContain("no detected downstream impact");
    });

    it("should generate formatted output", async () => {
      const report = await analyzer.analyzeNode("core-module");
      expect(report.formatted).toBeTruthy();
      expect(report.formatted).toContain("Blast Radius:");
      expect(report.formatted).toContain("core-module");
    });

    it("should include severity, confidence, and recommendation in formatted output", async () => {
      const report = await analyzer.analyzeNode("core-module");
      expect(report.formatted).toContain("HIGH");
      expect(report.formatted).toContain("85%");
      expect(report.formatted).toContain("Recommendation:");
    });

    it("should include directly affected nodes in formatted output", async () => {
      const report = await analyzer.analyzeNode("core-module");
      expect(report.formatted).toContain("service-a");
      expect(report.formatted).toContain("service-b");
    });

    it("should include affected features in formatted output", async () => {
      const report = await analyzer.analyzeNode("core-module");
      expect(report.formatted).toContain("feature-1");
    });

    it("should include generated_at timestamp", async () => {
      const report = await analyzer.analyzeNode("core-module");
      expect(report.generated_at).toBeTruthy();
      expect(() => new Date(report.generated_at)).not.toThrow();
    });

    it("should throw for non-existent node", async () => {
      await expect(analyzer.analyzeNode("nonexistent")).rejects.toThrow("Node not found");
    });
  });

  describe("analyzeNodes", () => {
    it("should analyze multiple nodes and sort by severity (critical first)", async () => {
      const results = await analyzer.analyzeNodes(["leaf-module", "core-module"]);
      expect(results).toHaveLength(2);
      // core-module (high severity) should come first (lower severityOrder index)
      expect(results[0].node_id).toBe("core-module");
      expect(results[1].node_id).toBe("leaf-module");
    });

    it("should return empty array for empty input", async () => {
      const results = await analyzer.analyzeNodes([]);
      expect(results).toHaveLength(0);
    });

    it("should handle a single node", async () => {
      const results = await analyzer.analyzeNodes(["leaf-module"]);
      expect(results).toHaveLength(1);
      expect(results[0].node_id).toBe("leaf-module");
    });
  });
});
