/**
 * session-manager.ts — Tier 1/3 Session Lifecycle Handler
 *
 * Handles session.start (Tier 1 sync) and session.idle (Tier 3 deferred).
 *
 * session.start:
 *   1. Resolve context for the active agent via ContextResolver
 *   2. Enforce cognitive budget — downgrade detail if limits exceeded
 *   3. Compile prompt via PromptCompiler to warm cache
 *   4. Log resolution stats
 *
 * session.idle:
 *   1. Run entropy scanner
 *   2. Write health report
 *
 * Design: single file exports one handler function; internal dispatch
 * based on event.type. The router calls the single exported function.
 */
import * as path from "path";
import type { RuntimeAdapter } from "../../adapters/runtime/bun/index.js";
import { ContextResolver } from "../../../tool/context-resolver/index.js";
import { PromptCompiler } from "../../../tool/prompt-compiler/index.js";
import { scanContextHealth } from "../../../tool/context-resolver/entropy-scanner.js";

// ── Agent Metadata Helpers ─────────────────────────────────────────────────

function getAgentMetadata(agentId: string, adapter: RuntimeAdapter): { meta: any; allAgents: any } {
  const metaPath = path.resolve(process.cwd(), ".opencode/config/agent-metadata.json");
  const raw = adapter.readTextFile(metaPath);
  if (!raw) return { meta: null, allAgents: {} };
  try {
    const parsed = JSON.parse(raw);
    return { meta: parsed?.agents?.[agentId] ?? null, allAgents: parsed?.agents ?? {} };
  } catch {
    return { meta: null, allAgents: {} };
  }
}

function calculateDependencyDepth(
  agentId: string,
  agentsMap: any,
  currentDepth = 0,
  visited = new Set<string>()
): number {
  if (visited.has(agentId)) return currentDepth;
  visited.add(agentId);
  const deps = agentsMap[agentId]?.dependencies || [];
  if (deps.length === 0) return currentDepth;
  let maxDepth = currentDepth;
  for (const dep of deps) {
    const depId = dep.includes(":") ? dep.split(":")[1].trim() : dep.trim();
    if (agentsMap[depId]) {
      const depth = calculateDependencyDepth(depId, agentsMap, currentDepth + 1, visited);
      maxDepth = Math.max(maxDepth, depth);
    }
  }
  return maxDepth;
}

// ── Main Handler ──────────────────────────────────────────────────────────

export async function handleSessionEvent(
  event: { type: string; agentId?: string; [key: string]: unknown },
  adapter: RuntimeAdapter
): Promise<void> {
  if (event.type === "session.start") {
    await handleStart(event, adapter);
  } else if (event.type === "session.idle") {
    await handleIdle(event, adapter);
  } else {
    adapter.log(`[session-manager] Unknown event type: ${event.type}`);
  }
}

// ── Session Start ─────────────────────────────────────────────────────────

async function handleStart(
  event: { type: string; agentId?: string; [key: string]: unknown },
  adapter: RuntimeAdapter
): Promise<void> {
  const agentId = (event.agentId as string | undefined) ?? "openagent";
  adapter.log(`[session-manager] session.start → resolving context for: ${agentId}`);

  const resolver = new ContextResolver();
  const compiler = new PromptCompiler();

  // Check budget to decide detail level
  const { meta, allAgents } = getAgentMetadata(agentId, adapter);
  const budget = meta?.cognitive_budget ?? null;
  let detail: "full" | "summary" | "symbolic" = "full";

  // First pass: full resolution to count chunks
  const probe = await resolver.resolve(agentId, "full");
  const totalChunks = Object.values(probe.chunks).reduce(
    (sum, chunks) => sum + chunks.length, 0
  );

  if (budget) {
    if (budget.max_loaded_chunks && totalChunks > budget.max_loaded_chunks) {
      detail = "summary";
      adapter.log(
        `[session-manager] cognitive_budget: ${totalChunks} chunks > limit ${budget.max_loaded_chunks} → "summary"`
      );
    } else if (budget.max_dependency_depth !== undefined) {
      const actualDepth = calculateDependencyDepth(agentId, allAgents);
      if (actualDepth > budget.max_dependency_depth) {
        detail = "summary";
        adapter.log(
          `[session-manager] dependency_depth ${actualDepth} > limit ${budget.max_dependency_depth} → "summary"`
        );
      }
    }
  }

  // Resolve with final detail level
  const bundle = detail === "full" ? probe : await resolver.resolve(agentId, detail);

  adapter.log(
    `[session-manager] context resolved: ${Object.keys(bundle.chunks).length} files, ` +
    `${totalChunks} chunks, missing: ${bundle.missing_files.length}`
  );

  // Warm the prompt compiler cache
  let agentMdPath = path.resolve(process.cwd(), `.opencode/agent/core/${agentId}.md`);
  if (meta?.category) {
    agentMdPath = path.resolve(process.cwd(), `.opencode/agent/${meta.category}/${agentId}.md`);
  }

  if (adapter.fileExists(agentMdPath)) {
    await compiler.compile(agentId, agentMdPath, bundle);
    adapter.log(`[session-manager] prompt cache warmed for ${agentId} (detail: ${detail})`);
  }

  // Write session stats via appendOutput
  await adapter.appendOutput({
    event_type: "session.start",
    tier: 1,
    agent: agentId,
    detail,
    files: Object.keys(bundle.chunks).length,
    chunks: totalChunks,
    missing: bundle.missing_files.length,
    dep_hash: bundle.dependency_hash?.slice(0, 8),
    budget_limit: budget?.max_loaded_chunks ?? "unlimited",
    downgraded: detail !== "full",
  }, `session-${agentId}-${Date.now()}.json`);
}

// ── Session Idle ───────────────────────────────────────────────────────────

async function handleIdle(
  _event: { type: string; [key: string]: unknown },
  adapter: RuntimeAdapter
): Promise<void> {
  adapter.log("[session-manager] session.idle → running entropy scanner");

  try {
    const report = await scanContextHealth();
    await adapter.appendOutput({
      event_type: "session.idle.health",
      tier: 3,
      ...report,
    }, `entropy-${Date.now()}.json`);
    adapter.log("[session-manager] entropy report written");
  } catch (err) {
    adapter.log(`[session-manager] entropy scanner failed (non-fatal): ${err}`);
  }
}
