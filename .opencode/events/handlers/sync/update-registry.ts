/**
 * Tier 1 Handler: update-registry
 *
 * Synchronous, transactional handler for critical state mutations.
 * Called when a registry write or audit promotion is confirmed.
 *
 * SAFETY RULES:
 * - Always read current state before writing (no blind overwrites).
 * - Always write to inferred/ only, unless explicitly instructed by audit promotion.
 * - Always snapshot before mutating verified/ state.
 * - Never run concurrently — the router guarantees sequential Tier 1 execution.
 */

import type { RuntimeAdapter } from "../../adapters/runtime/bun/index.js";

export interface RegistryUpdateEvent {
  type: "state.registry.write" | "audit.promotion.confirmed";
  target: "inferred" | "verified";
  registry: "features" | "architecture" | "dependencies";
  payload: unknown;
  promotedBy?: string;
  timestamp: string;
}

/**
 * Apply a registry update, creating a snapshot first if writing to verified/.
 */
export async function handleRegistryUpdate(
  event: RegistryUpdateEvent,
  adapter: RuntimeAdapter
): Promise<void> {
  const registryPath = resolveRegistryPath(event.target, event.registry);

  adapter.log(`[update-registry] Writing to ${registryPath}`);

  // Safety: if writing to verified/, create snapshot first
  if (event.target === "verified") {
    const snapshotPath = resolveSnapshotPath(event.registry);
    await adapter.snapshot(registryPath, snapshotPath);
    adapter.log(`[update-registry] Snapshot created at ${snapshotPath}`);
  }

  // Read current state
  const current = await adapter.readJSON(registryPath);

  // Merge update (never blindly replace — always merge)
  const updated = mergeRegistryUpdate(current, event.payload);

  // Write atomically (write to temp, rename)
  await adapter.writeJSONAtomic(registryPath, updated);

  adapter.log(`[update-registry] Done — ${registryPath} updated`);

  // Write audit log entry
  await adapter.appendOutput({
    event_type: event.type,
    tier: 1,
    timestamp: event.timestamp,
    trigger: `Registry write: ${event.target}/${event.registry}`,
    analysis: {
      what_changed: `Updated ${event.registry} in ${event.target} registry`,
      impact: event.target === "verified" ? "high" : "low",
      confidence: 1.0,
    },
    recommendations: [],
    state_updates: {
      path: registryPath,
      changes: "Registry merge applied",
    },
  });
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function resolveRegistryPath(target: "inferred" | "verified", registry: string): string {
  const fileMap: Record<string, string> = {
    features: "feature-registry.json",
    architecture: "architecture-graph.json",
    dependencies: "dependency-state.json",
  };
  return `.opencode/state/${target}/${registry}/${fileMap[registry]}`;
}

function resolveSnapshotPath(registry: string): string {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  return `.opencode/state/snapshots/${registry}-${ts}.json`;
}

function mergeRegistryUpdate(current: Record<string, unknown>, update: unknown): unknown {
  if (typeof update !== "object" || update === null) return current;
  // Deep merge — features/nodes are keyed objects, merge at top level
  return { ...current, ...(update as object) };
}
