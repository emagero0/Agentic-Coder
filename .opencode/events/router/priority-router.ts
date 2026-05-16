/**
 * Priority Router — OAC Cognitive Event System
 *
 * Routes incoming OpenCode events to the correct processing tier:
 *   Tier 1: Critical / Synchronous  — state mutations, governance
 *   Tier 2: Background / Async     — analysis, drift detection, reporting
 *   Tier 3: Deferred / Scheduled   — weekly audits, ecosystem research
 *
 * Design constraint: This module must remain runtime-agnostic.
 * Use the shared runtime adapter, not Bun-specific APIs directly.
 */

import type { RuntimeAdapter } from "../adapters/runtime/bun/index.js";

// ─── Event Type Classification ─────────────────────────────────────────────

type EventTier = 1 | 2 | 3;

interface RoutedEvent {
  original: unknown;
  tier: EventTier;
  handler: string;
}

/**
 * Maps OpenCode event types to their processing tier and target handler.
 * Add new event mappings here as the system grows.
 */
const EVENT_ROUTING_TABLE: Record<string, { tier: EventTier; handler: string }> = {
  // Tier 1 — Critical (synchronous, state-mutating)
  "state.registry.write":        { tier: 1, handler: "update-registry" },
  "audit.promotion.confirmed":   { tier: 1, handler: "update-registry" },

  // Tier 2 — Background analysis (async, report-generating)
  "file.watcher.updated":        { tier: 2, handler: "analyze-drift" },
  "file.edited":                 { tier: 2, handler: "analyze-drift" },
  "tool.execute.after":          { tier: 2, handler: "check-dependencies" },
  "session.completed":           { tier: 2, handler: "analyze-drift" },

  // Tier 3 — Deferred / Scheduled
  "schedule.weekly":             { tier: 3, handler: "weekly-audit" },

  // Phase 4 — R&D Supervisor events
  "research.topic.created":      { tier: 2, handler: "analyze-drift" },
  "experiment.completed":        { tier: 1, handler: "update-registry" },
  "ecosystem.watch.trigger":     { tier: 3, handler: "ecosystem-watch" },

  // Phase 6 — Token Optimization / Cache Invalidation
  "cache.invalidate":            { tier: 1, handler: "invalidate-cache" },

  // Phase 7 — Session Lifecycle Management
  "session.start":               { tier: 1, handler: "session-manager" },
  "session.idle":                { tier: 3, handler: "session-manager" },
};

// ─── Router ────────────────────────────────────────────────────────────────

/**
 * Classify an incoming event and route it to the appropriate tier.
 * Unknown events default to Tier 2 (async analysis) to avoid blocking.
 */
export function classifyEvent(event: { type: string }): RoutedEvent {
  const route = EVENT_ROUTING_TABLE[event.type] ?? { tier: 2, handler: "analyze-drift" };
  return { original: event, tier: route.tier, handler: route.handler };
}

/**
 * Main router entry point called by the plugin entry point (tool/events/index.ts).
 *
 * Tier 1 events are awaited (synchronous).
 * Tier 2 events are dispatched without await (fire-and-forget).
 * Tier 3 events are queued for deferred execution.
 */
export async function routeEvent(
  event: { type: string; [key: string]: unknown },
  adapter: RuntimeAdapter
): Promise<void> {
  const routed = classifyEvent(event);

  adapter.log(`[EventRouter] ${event.type} → Tier ${routed.tier} (${routed.handler})`);

  switch (routed.tier) {
    case 1:
      // Synchronous — must complete before proceeding
      await adapter.runSync(routed.handler, routed.original);
      break;

    case 2:
      // Async — dispatch without blocking
      adapter.runAsync(routed.handler, routed.original);
      break;

    case 3:
      // Deferred — queue for later execution
      adapter.runDeferred(routed.handler, routed.original);
      break;
  }
}
