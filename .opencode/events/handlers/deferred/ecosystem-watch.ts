/**
 * ecosystem-watch.ts — Tier 3 Deferred Event Handler
 *
 * Fires on: session.idle, schedule.weekly
 *
 * Purpose: Lightweight ecosystem health check that runs in the background.
 * Checks for stale dependencies, dormant research topics, and generates
 * a summary signal for the RndSupervisor to act on.
 *
 * Does NOT fetch external data directly — that is the responsibility of
 * the RndSupervisor via the External Intelligence Gateway.
 */

import * as path from "path";
import type { RuntimeAdapter } from "../../adapters/runtime/bun/index.js";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DependencyState {
  dependencies: Array<{
    name: string;
    installed_version: string;
    wanted_version: string;
    stale: boolean;
    last_checked?: string;
  }>;
}

interface ResearchTopic {
  id: string;
  title: string;
  status: "open" | "in-progress" | "concluded" | "archived";
  created_at: string;
  last_activity?: string;
}

interface ResearchRegistry {
  topics: ResearchTopic[];
  ecosystem_watch: Array<{ generated_at: string }>;
}

export interface EcosystemWatchReport {
  generated_at: string;
  trigger: "session.idle" | "schedule.weekly";
  stale_dependencies: {
    count: number;
    names: string[];
  };
  dormant_topics: {
    count: number;
    ids: string[];
  };
  action_required: boolean;
  recommended_actions: string[];
}

// ── Paths ─────────────────────────────────────────────────────────────────────

const ROOT = process.cwd();
const DEP_STATE_PATH = path.join(ROOT, ".opencode/state/inferred/dependencies/dependency-state.json");
const RESEARCH_REGISTRY_PATH = path.join(ROOT, ".opencode/state/research/research-registry.json");
const OUTPUT_DIR = path.join(ROOT, ".opencode/events/outputs");

// ── Helpers ───────────────────────────────────────────────────────────────────

function readJson<T>(filePath: string, adapter: RuntimeAdapter): T | null {
  const content = adapter.readTextFile(filePath);
  if (!content) return null;
  try { return JSON.parse(content) as T; } catch { return null; }
}

function daysSince(isoDate: string): number {
  const then = new Date(isoDate).getTime();
  const now = Date.now();
  return Math.floor((now - then) / (1000 * 60 * 60 * 24));
}

// ── Main Handler ──────────────────────────────────────────────────────────────
// Note: The second param (adapter) is unused by this handler as it uses
// static paths and JSON parsing. It's accepted for interface compatibility
// with the RuntimeAdapter dispatch mechanism.

export async function handleEcosystemWatch(
  trigger: "session.idle" | "schedule.weekly" = "session.idle",
  adapter: RuntimeAdapter
): Promise<EcosystemWatchReport> {
  const now = new Date().toISOString();
  const report: EcosystemWatchReport = {
    generated_at: now,
    trigger,
    stale_dependencies: { count: 0, names: [] },
    dormant_topics: { count: 0, ids: [] },
    action_required: false,
    recommended_actions: [],
  };

  // ── 1. Check for stale dependencies ────────────────────────────────────────
  const depState = readJson<DependencyState>(DEP_STATE_PATH, adapter);
  if (depState?.dependencies) {
    const stale = depState.dependencies.filter((d) => d.stale === true);
    report.stale_dependencies = {
      count: stale.length,
      names: stale.map((d) => d.name),
    };
    if (stale.length > 0) {
      report.action_required = true;
      report.recommended_actions.push(
        `Run /research dependencies — ${stale.length} stale package(s) detected`
      );
    }
  }

  // ── 2. Check for dormant research topics ───────────────────────────────────
  const registry = readJson<ResearchRegistry>(RESEARCH_REGISTRY_PATH, adapter);
  if (registry?.topics) {
    const dormantThresholdDays = 7;
    const dormant = registry.topics.filter((t) => {
      if (t.status === "concluded" || t.status === "archived") return false;
      const lastActivity = t.last_activity ?? t.created_at;
      return daysSince(lastActivity) >= dormantThresholdDays;
    });
    report.dormant_topics = {
      count: dormant.length,
      ids: dormant.map((t) => t.id),
    };
    if (dormant.length > 0) {
      report.action_required = true;
      report.recommended_actions.push(
        `${dormant.length} research topic(s) dormant for >${dormantThresholdDays} days — run /research topics`
      );
    }
  }

  // ── 3. Check if weekly digest is overdue ───────────────────────────────────
  if (trigger === "schedule.weekly" && registry) {
    const lastDigest = registry.ecosystem_watch
      .map((e) => e.generated_at)
      .sort()
      .pop();
    if (!lastDigest || daysSince(lastDigest) >= 7) {
      report.action_required = true;
      report.recommended_actions.push("Weekly digest overdue — run /research summary");
    }
  }

  // ── 4. Write output ────────────────────────────────────────────────────────
  adapter.ensureDirectory(OUTPUT_DIR);
  const dateSlug = now.slice(0, 10).replace(/-/g, "");
  const outputPath = path.join(OUTPUT_DIR, `ecosystem-watch-${dateSlug}.json`);
  adapter.writeTextFile(outputPath, JSON.stringify(report, null, 2));

  return report;
}
