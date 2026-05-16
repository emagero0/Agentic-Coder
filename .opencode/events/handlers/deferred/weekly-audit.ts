/**
 * Tier 3 Handler: weekly-audit
 *
 * Deferred handler triggered by session.idle or schedule.weekly events.
 * Reads all inferred/verified state and produces a consolidated advisory report.
 * ADVISORY ONLY — no state modifications, no code changes.
 */

import type { RuntimeAdapter } from "../../adapters/runtime/bun/index.js";

export interface ScheduledEvent {
  type: "session.idle" | "schedule.weekly";
  timestamp: string;
}

export async function handleWeeklyAudit(
  event: ScheduledEvent,
  adapter: RuntimeAdapter
): Promise<void> {
  adapter.log("[weekly-audit] Starting deferred audit...");
  const timestamp = event.timestamp ?? new Date().toISOString();

  const [inferredFeatures, verifiedFeatures, inferredArch, inferredDeps] = await Promise.all([
    adapter.readJSON(".opencode/state/inferred/features/feature-registry.json").catch(() => null),
    adapter.readJSON(".opencode/state/verified/features/feature-registry.json").catch(() => null),
    adapter.readJSON(".opencode/state/inferred/architecture/architecture-graph.json").catch(() => null),
    adapter.readJSON(".opencode/state/inferred/dependencies/dependency-state.json").catch(() => null),
  ]);

  const toObj = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});

  const inferredFeatureCount = Object.keys(toObj(toObj(inferredFeatures)["features"]).constructor === Object ? toObj(toObj(inferredFeatures)["features"]) : {}).length;
  const verifiedFeatureCount = Object.keys(toObj(toObj(verifiedFeatures)["features"])).length;
  const inferredNodeCount = (Array.isArray(toObj(inferredArch)["nodes"]) ? toObj(inferredArch)["nodes"] as unknown[] : []).length;
  const isDepStale = toObj(inferredDeps)["stale"] === true;

  const recommendations: Array<{ action: string; priority: string; requires_approval: boolean }> = [];

  if (inferredFeatureCount > 0 && verifiedFeatureCount === 0) {
    recommendations.push({ action: `${inferredFeatureCount} features unverified. Run /audit features.`, priority: "high", requires_approval: false });
  }
  if (isDepStale) {
    recommendations.push({ action: "Dependency state is stale. Run /audit dependencies.", priority: "high", requires_approval: false });
  }
  if (inferredNodeCount === 0) {
    recommendations.push({ action: "No architecture nodes tracked. Run /scan-state.", priority: "medium", requires_approval: false });
  }

  const report = {
    event_type: "audit.weekly",
    tier: 3,
    timestamp,
    trigger: event.type,
    analysis: { features_inferred: inferredFeatureCount, features_verified: verifiedFeatureCount, architecture_nodes: inferredNodeCount, dependency_stale: isDepStale },
    recommendations,
    state_updates: null,
    note: "Advisory only. No state was modified.",
  };

  await adapter.appendOutput(report, `weekly-audit-${timestamp.slice(0, 10)}.json`);
  adapter.log("[weekly-audit] Report written");
}
