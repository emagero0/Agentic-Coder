/**
 * Tier 2 Handler: check-dependencies
 *
 * Async background handler triggered when a tool execution completes.
 * Detects dependency file changes, queries OSV.dev for CVEs,
 * checks npm registry for version drift, and generates a risk report.
 *
 * Never modifies source code or runs package managers automatically.
 */

import type { RuntimeAdapter } from "../../adapters/runtime/bun/index.js";
import { ExternalGateway } from "../../../tool/external-gateway/index.js";

export interface ToolExecutedEvent {
  type: "tool.execute.after";
  tool: string;
  args?: Record<string, unknown>;
  output?: unknown;
  timestamp: string;
}

const DEPENDENCY_FILE_PATTERNS = [
  /package\.json$/,
  /package-lock\.json$/,
  /bun\.lockb$/,
  /yarn\.lock$/,
  /pnpm-lock\.yaml$/,
  /Cargo\.toml$/,
  /Cargo\.lock$/,
  /go\.mod$/,
  /go\.sum$/,
  /pyproject\.toml$/,
  /requirements\.txt$/,
];

/**
 * Full risk report for dependency intelligence.
 */
export interface DependencyRiskReport {
  event_type: "dependency.risk";
  tier: 2;
  timestamp: string;
  trigger: string;
  package_json_checked: boolean;
  summary: {
    total_deps_checked: number;
    cves_found: number;
    outdated_found: number;
    risk_level: "none" | "low" | "medium" | "high" | "critical";
  };
  findings: DependencyFinding[];
  recommendations: string[];
}

export interface DependencyFinding {
  package_name: string;
  current_version: string;
  type: "production" | "development";
  cves: CveEntry[];
  latest_version?: string;
  is_outdated: boolean;
  risk: "none" | "low" | "medium" | "high" | "critical";
  note: string;
}

export interface CveEntry {
  id: string;
  severity: string;
  cvss?: number;
  summary: string;
}

/**
 * Check dependencies after a tool execution.
 * Queries OSV.dev for CVEs and npm registry for version drift.
 */
export async function handleCheckDependencies(
  event: ToolExecutedEvent,
  adapter: RuntimeAdapter
): Promise<void> {
  adapter.log(`[check-dependencies] Tool executed: ${event.tool}`);

  const affectedFiles = extractAffectedFiles(event);
  const dependencyFiles = affectedFiles.filter((f) =>
    DEPENDENCY_FILE_PATTERNS.some((p) => p.test(f))
  );

  if (dependencyFiles.length === 0) {
    adapter.log("[check-dependencies] No dependency files touched — skipping");
    return;
  }

  adapter.log(`[check-dependencies] Dependency files changed: ${dependencyFiles.join(", ")}`);

  // Read package.json to get current dependency list
  const pkgJsonPath = ".opencode/package.json";
  const pkgJson = adapter.readTextFile(pkgJsonPath);
  let depsToCheck: { name: string; version: string; type: "production" | "development" }[] = [];

  if (pkgJson) {
    try {
      const parsed = JSON.parse(pkgJson);
      const prod = parsed.dependencies ?? {};
      const dev = parsed.devDependencies ?? {};
      for (const [name, ver] of Object.entries<string>(prod)) {
        depsToCheck.push({ name, version: cleanVersion(ver), type: "production" });
      }
      for (const [name, ver] of Object.entries<string>(dev)) {
        depsToCheck.push({ name, version: cleanVersion(ver), type: "development" });
      }
    } catch (e) {
      adapter.log(`[check-dependencies] Failed to parse package.json: ${e}`);
    }
  }

  const gateway = new ExternalGateway();
  const findings: DependencyFinding[] = [];
  let totalCves = 0;
  let totalOutdated = 0;

  // Check up to 10 deps per trigger to stay within rate limits
  const batch = depsToCheck.slice(0, 10);
  for (const dep of batch) {
    const finding: DependencyFinding = {
      package_name: dep.name,
      current_version: dep.version,
      type: dep.type,
      cves: [],
      is_outdated: false,
      risk: "none",
      note: "",
    };

    // Query OSV.dev for CVEs affecting this package
    try {
      const osvResult = await gateway.getOsvVulnerabilities(
        "npm",
        dep.name,
        dep.version
      );
      const vulns = (osvResult.data as { vulns?: unknown[] }).vulns ?? [];
      if (vulns.length > 0) {
        for (const v of vulns) {
          const entry = v as { id?: string; severity?: string; cvss?: number; summary?: string };
          finding.cves.push({
            id: entry.id ?? "unknown",
            severity: entry.severity ?? "unknown",
            cvss: entry.cvss,
            summary: entry.summary ?? "No summary",
          });
          totalCves++;
        }
        finding.risk = classifyCveRisk(finding.cves);
      }
    } catch (e) {
      finding.note = `OSV query failed: ${e}`;
    }

    // Query npm registry for latest version (production deps only)
    if (dep.type === "production") {
      try {
        const npmResult = await gateway.getNpmPackage(dep.name);
        const npmData = npmResult.data as { "dist-tags"?: { latest?: string } };
        if (npmData?.["dist-tags"]?.latest) {
          const latest = npmData["dist-tags"].latest;
          finding.latest_version = latest;
          if (latest !== dep.version && !dep.version.startsWith("0.")) {
            finding.is_outdated = true;
            totalOutdated++;
            if (finding.risk === "none") finding.risk = "low";
          }
        }
      } catch (e) {
        // npm registry query failure is non-critical
        finding.note = finding.note
          ? `${finding.note}; npm query failed: ${e}`
          : `npm query failed: ${e}`;
      }
    }

    findings.push(finding);
  }

  // Determine overall risk level
  const riskLevel = totalCves > 0 ? "high" : totalOutdated > 2 ? "medium" : totalOutdated > 0 ? "low" : "none";

  // Build and write report
  const report: DependencyRiskReport = {
    event_type: "dependency.risk",
    tier: 2,
    timestamp: event.timestamp ?? new Date().toISOString(),
    trigger: `${event.tool} modified: ${dependencyFiles.join(", ")}`,
    package_json_checked: !!pkgJson,
    summary: {
      total_deps_checked: batch.length,
      cves_found: totalCves,
      outdated_found: totalOutdated,
      risk_level: riskLevel,
    },
    findings,
    recommendations: buildRecommendations(findings, riskLevel),
  };

  await adapter.appendOutput(report, `dependency-risk-${Date.now()}.json`);
  adapter.log(
    `[check-dependencies] Report written: ${totalCves} CVEs, ${totalOutdated} outdated, risk: ${riskLevel}`
  );

  // Mark inferred dependency state as stale
  const depStatePath = ".opencode/state/inferred/dependencies/dependency-state.json";
  const current = await adapter.readJSON(depStatePath).catch(() => ({}));
  const updated = {
    ...current,
    last_scanned: null,
    stale: true,
    stale_reason: `${event.tool} modified dependency files at ${event.timestamp}`,
    stale_files: dependencyFiles,
    last_risk_report: {
      timestamp: report.timestamp,
      cves_found: totalCves,
      outdated_found: totalOutdated,
      risk_level: riskLevel,
    },
  };
  await adapter.writeJSONAtomic(depStatePath, updated);
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function extractAffectedFiles(event: ToolExecutedEvent): string[] {
  const candidates: string[] = [];
  if (event.args) {
    Object.values(event.args).forEach((v) => {
      if (typeof v === "string" && v.includes(".")) candidates.push(v);
    });
  }
  return candidates;
}

function cleanVersion(ver: string): string {
  return ver.replace(/^[\^~>=<]/, "");
}

function classifyCveRisk(cves: { severity: string }[]): "low" | "medium" | "high" | "critical" {
  const severities = cves.map((c) => c.severity.toLowerCase());
  if (severities.some((s) => s === "critical")) return "critical";
  if (severities.some((s) => s === "high")) return "high";
  if (severities.some((s) => s === "medium")) return "medium";
  return "low";
}

function buildRecommendations(
  findings: DependencyFinding[],
  riskLevel: string
): string[] {
  const recs: string[] = [];

  if (riskLevel === "critical" || riskLevel === "high") {
    recs.push("CRITICAL: Vulnerabilities detected — run `npm audit` and review CVE list immediately");
  }

  for (const f of findings) {
    if (f.cves.length > 0) {
      recs.push(`CVE: ${f.package_name}@${f.current_version} has ${f.cves.length} vulnerability(ies)`);
    }
    if (f.is_outdated && f.latest_version) {
      recs.push(`OUTDATED: ${f.package_name} ${f.current_version} → ${f.latest_version}`);
    }
  }

  if (findings.length > 0 && recs.length === 0) {
    recs.push("All checked dependencies are current and vulnerability-free");
  }

  return recs;
}
