/**
 * dependency-resolver.ts — Context Dependency Resolver
 *
 * Declares the static dependency map for the OAC framework:
 *   - Which agents depend on which context files
 *   - Which supervisors depend on which registry files
 *   - Which commands depend on which context files and graph capabilities
 *
 * This is a declarative configuration file, NOT a dynamic resolver.
 * Context dependencies should be maintained here as agents and supervisors evolve.
 *
 * Design constraints:
 *   - Paths are relative to the project root (cwd)
 *   - All paths must exist at resolution time (checked lazily, not eagerly)
 *   - No circular dependencies between the resolver and the systems it maps
 *   - Context Manifest Registry (context-manifest.json) is updated on first use
 */

import * as fs from "fs";
import * as path from "path";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ResolvedDeps {
  /** Absolute paths to all required context/markdown files */
  context_files: string[];
  /** Absolute paths to all required registry/JSON files */
  registry_files: string[];
  /** Whether this invocation requires graph engine loading */
  requires_graph: boolean;
  /** Chunk IDs to load per file (empty array = load all chunks) */
  chunk_filters: Record<string, string[]>;  // absolute_path → chunk_ids
}

export interface ResolvedContextBundle {
  deps: ResolvedDeps;
  /** Composite dependency hash across all resolved files */
  dependency_hash: string;
  /** Individual file fingerprints */
  file_fingerprints: Record<string, string>;  // absolute_path → sha256
}

// ── Static Dependency Map ──────────────────────────────────────────────────────

const ROOT = process.cwd();

function abs(relativePath: string): string {
  return path.resolve(ROOT, relativePath);
}

/**
 * Context files shared by all agents.
 * These are loaded regardless of which specific agent is invoked.
 */
const SHARED_CONTEXT: string[] = [
  ".opencode/context/core/project-context.md",
  ".opencode/context/core/standards/code-quality.md",
];

/**
 * Agent-to-context file dependency map.
 * Keys are agent IDs as declared in agent-metadata.json.
 */
const AGENT_CONTEXT_DEPS: Record<string, string[]> = {
  "open-coder": [
    ".opencode/context/core/stack.md",
    ".opencode/context/core/patterns/architecture-patterns.md",
    ".opencode/context/core/standards/code-quality.md",
  ],
  "code-reviewer": [
    ".opencode/context/core/standards/code-quality.md",
    ".opencode/context/core/standards/security-patterns.md",
    ".opencode/context/core/standards/testing-standards.md",
  ],
  "test-engineer": [
    ".opencode/context/core/standards/testing-standards.md",
    ".opencode/context/core/stack.md",
  ],
  "docs-writer": [
    ".opencode/context/core/project-context.md",
    ".opencode/context/core/standards/code-quality.md",
  ],
  "architecture-supervisor": [
    ".opencode/context/core/patterns/architecture-patterns.md",
    ".opencode/state/verified/architecture/architecture-graph.json",
    ".opencode/state/inferred/architecture/architecture-graph.json",
  ],
  "project-manager-supervisor": [
    ".opencode/state/verified/features/feature-registry.json",
    ".opencode/state/inferred/features/feature-registry.json",
  ],
  "memory-curator": [
    ".opencode/state/verified/",
    ".opencode/state/inferred/",
    ".opencode/state/snapshots/",
  ],
  "rnd-supervisor": [
    ".opencode/state/inferred/dependencies/dependency-state.json",
    ".opencode/state/research/research-registry.json",
  ],
  "graph-query-engine": [
    ".opencode/state/verified/architecture/architecture-graph.json",
  ],
  "meta-supervisor": [
    ".opencode/agent/supervisors/meta-supervisor.md",
  ],
};

/**
 * Supervisor-to-registry dependency map.
 * These are the files each supervisor reads during an audit invocation.
 */
const SUPERVISOR_REGISTRY_DEPS: Record<string, string[]> = {
  "architecture-supervisor": [
    ".opencode/state/verified/architecture/architecture-graph.json",
    ".opencode/state/inferred/architecture/architecture-graph.json",
    ".opencode/config/agent-metadata.json",
  ],
  "project-manager-supervisor": [
    ".opencode/state/verified/features/feature-registry.json",
    ".opencode/state/inferred/features/feature-registry.json",
  ],
  "memory-curator": [
    ".opencode/state/verified/features/feature-registry.json",
    ".opencode/state/verified/architecture/architecture-graph.json",
    ".opencode/state/snapshots/",
  ],
  "rnd-supervisor": [
    ".opencode/state/inferred/dependencies/dependency-state.json",
    ".opencode/state/research/research-registry.json",
  ],
  "meta-supervisor": [
    ".opencode/state/agents/agent-capabilities.json",
    ".opencode/config/agent-metadata.json",
  ],
};

/**
 * Command-to-dependency map.
 * Declares what context each slash command needs to execute.
 */
const COMMAND_DEPS: Record<string, { context: string[]; graph: boolean; registries: string[] }> = {
  "/audit architecture": {
    context: [".opencode/agent/supervisors/architecture-supervisor.md"],
    graph: true,
    registries: [...(SUPERVISOR_REGISTRY_DEPS["architecture-supervisor"] ?? [])],
  },
  "/audit features": {
    context: [".opencode/agent/supervisors/project-manager-supervisor.md"],
    graph: true,
    registries: [...(SUPERVISOR_REGISTRY_DEPS["project-manager-supervisor"] ?? [])],
  },
  "/audit memory": {
    context: [".opencode/agent/supervisors/memory-curator.md"],
    graph: false,
    registries: [...(SUPERVISOR_REGISTRY_DEPS["memory-curator"] ?? [])],
  },
  "/graph": {
    context: [],
    graph: true,
    registries: [".opencode/state/verified/architecture/architecture-graph.json"],
  },
  "/research": {
    context: [".opencode/agent/supervisors/rnd-supervisor.md"],
    graph: false,
    registries: [".opencode/state/inferred/dependencies/dependency-state.json"],
  },
  "/cache": {
    context: [],
    graph: false,
    registries: [
      ".opencode/cache/invalidation/manifest.json",
      ".opencode/cache/manifest/context-manifest.json",
    ],
  },
};

// ── Policy Module Map (Phase 2: Dynamic Policy Injection) ──────────────────────

/**
 * Core policy files loaded on EVERY invocation.
 * These are the minimum cognitive overhead (~129 lines total).
 */
const CORE_POLICIES: string[] = [
  ".opencode/agent/core/openagent-core.md",
  ".opencode/agent/core/policies/permissions.md",
  ".opencode/agent/core/policies/approval-gates.md",
  ".opencode/agent/core/policies/safety.md",
];

/**
 * Task-type to policy module map.
 * Only loads modules relevant to the current task classification.
 */
const POLICY_MODULES: Record<string, string[]> = {
  "conversational": [
    // Core only — no extra policies needed for questions
  ],
  "code-task": [
    ".opencode/agent/core/workflows/task-execution.md",
    ".opencode/agent/core/workflows/context-loading.md",
  ],
  "delegation": [
    ".opencode/agent/core/orchestration/delegation.md",
    ".opencode/agent/core/orchestration/routing-table.md",
    ".opencode/agent/core/workflows/context-loading.md",
  ],
  "parallel-task": [
    ".opencode/agent/core/orchestration/delegation.md",
    ".opencode/agent/core/orchestration/batching.md",
    ".opencode/agent/core/workflows/context-loading.md",
  ],
  "review": [
    ".opencode/agent/core/workflows/task-execution.md",
    ".opencode/agent/core/workflows/context-loading.md",
  ],
  "discovery": [
    ".opencode/agent/core/scout/contextscout-usage.md",
  ],
  "external-lib": [
    ".opencode/agent/core/scout/externalscout-usage.md",
  ],
};

/**
 * Resolve which policy modules to load for a given task type.
 * Returns absolute paths to all required policy files.
 *
 * @param taskType - One of: conversational, code-task, delegation,
 *                   parallel-task, review, discovery, external-lib
 * @returns Deduplicated absolute paths to policy module files
 */
export function resolvePolicies(taskType: string): string[] {
  const core = CORE_POLICIES.map(abs);
  const extra = (POLICY_MODULES[taskType] ?? []).map(abs);
  return [...new Set([...core, ...extra])];
}

// ── Context Manifest Updater ───────────────────────────────────────────────────

const CONTEXT_MANIFEST_PATH = path.resolve(
  ROOT,
  ".opencode/cache/manifest/context-manifest.json"
);

function updateContextManifest(
  contextFile: string,
  consumers: string[]
): void {
  let manifest: Record<string, unknown> = {
    schema_version: "1.0",
    generated_at: new Date().toISOString(),
    entries: {},
  };

  if (fs.existsSync(CONTEXT_MANIFEST_PATH)) {
    try {
      manifest = JSON.parse(fs.readFileSync(CONTEXT_MANIFEST_PATH, "utf-8"));
    } catch {
      // Use fresh manifest on parse error
    }
  }

  const entries = (manifest.entries as Record<string, unknown>) ?? {};
  const relPath = path.relative(ROOT, contextFile).replace(/\\/g, "/");
  const existing = (entries[relPath] as { consumed_by?: string[] }) ?? {};
  const existingConsumers = new Set(existing.consumed_by ?? []);
  consumers.forEach((c) => existingConsumers.add(c));

  entries[relPath] = {
    ...(typeof existing === "object" ? existing : {}),
    consumed_by: [...existingConsumers],
  };

  manifest.entries = entries;
  manifest.generated_at = new Date().toISOString();

  fs.writeFileSync(CONTEXT_MANIFEST_PATH, JSON.stringify(manifest, null, 2));
}

/**
 * Agent-specific chunk filters.
 * Specifies which chunks each agent needs from each context file.
 * If an agent-file pair is not listed, ALL chunks load (backward compatible).
 */
const AGENT_CHUNK_FILTERS: Record<string, Record<string, string[]>> = {
  "code-reviewer": {
    ".opencode/context/core/standards/code-quality.md": [
      "code-quality.naming-conventions",
      "code-quality.error-handling",
      "code-quality.security",
    ],
  },
  "test-engineer": {
    ".opencode/context/core/standards/testing-standards.md": [
      "testing-standards.coverage-requirements",
      "testing-standards.test-patterns",
    ],
  },
  "docs-writer": {
    ".opencode/context/core/project-context.md": [
      "project-context.overview",
      "project-context.conventions",
    ],
  },
};

// ── Resolver ───────────────────────────────────────────────────────────────────

export function resolveDeps(agentId: string): ResolvedDeps {
  const agentSpecific = (AGENT_CONTEXT_DEPS[agentId] ?? []).map(abs);
  const shared = SHARED_CONTEXT.map(abs);
  const registries = (SUPERVISOR_REGISTRY_DEPS[agentId] ?? []).map(abs);

  // Deduplicate
  const allContext = [...new Set([...shared, ...agentSpecific])];

  // Build chunk filters from agent-specific map
  const rawFilters = AGENT_CHUNK_FILTERS[agentId] ?? {};
  const chunkFilters: Record<string, string[]> = {};
  for (const [relPath, chunks] of Object.entries(rawFilters)) {
    chunkFilters[abs(relPath)] = chunks;
  }

  // Update context manifest with consumer info (best-effort, non-blocking)
  for (const f of allContext) {
    try { updateContextManifest(f, [agentId]); } catch { /* non-blocking */ }
  }

  return {
    context_files: allContext,
    registry_files: registries,
    requires_graph: ["architecture-supervisor", "graph-query-engine", "project-manager-supervisor"]
      .includes(agentId),
    chunk_filters: chunkFilters,
  };
}

export function resolveCommandDeps(command: string): ResolvedDeps {
  // Normalize command (handle /graph blast-radius → /graph)
  const normalized = Object.keys(COMMAND_DEPS).find(
    (k) => command === k || command.startsWith(k + " ")
  ) ?? command;

  const spec = COMMAND_DEPS[normalized];
  if (!spec) {
    // Unknown command — return empty deps
    return {
      context_files: [],
      registry_files: [],
      requires_graph: false,
      chunk_filters: {},
    };
  }

  return {
    context_files: [...SHARED_CONTEXT.map(abs), ...spec.context.map(abs)],
    registry_files: spec.registries.map(abs),
    requires_graph: spec.graph,
    chunk_filters: {},
  };
}

/**
 * Returns all unique context files across all agents.
 * Useful for bootstrapping the context manifest on first run.
 */
export function getAllContextFiles(): string[] {
  const all = new Set<string>([
    ...SHARED_CONTEXT,
    ...Object.values(AGENT_CONTEXT_DEPS).flat(),
  ]);
  return [...all].map(abs);
}

/**
 * Returns all agents that depend on a given context file.
 * Used by the invalidation engine to scope eviction.
 */
export function getConsumers(contextFilePath: string): string[] {
  const normalized = contextFilePath.replace(/\\/g, "/");
  const consumers: string[] = [];

  for (const [agentId, deps] of Object.entries(AGENT_CONTEXT_DEPS)) {
    if (deps.some((d) => normalized.endsWith(d) || d.endsWith(normalized))) {
      consumers.push(agentId);
    }
  }

  // Also check supervisor registry deps
  for (const [supervisorId, deps] of Object.entries(SUPERVISOR_REGISTRY_DEPS)) {
    if (deps.some((d) => normalized.endsWith(d) || d.endsWith(normalized))) {
      if (!consumers.includes(supervisorId)) consumers.push(supervisorId);
    }
  }

  return consumers;
}
