---
description: "Scan the current project and populate the inferred state registries with provisional confidence-scored entries. Never writes to verified/."
---

# /scan-state

Scan the current project workspace and populate the **inferred** state registries with provisional,
confidence-scored findings. This is the bootstrap entry point for the OAC cognitive platform.

**IMPORTANT**: This command only writes to `.opencode/state/inferred/`. The `verified/` registries
are never touched by this command. Promotion from inferred → verified requires `/audit` commands
and human confirmation.

---

## What This Command Does

### Step 1 — Pre-Scan Safety Check

Before scanning:
1. Read `.opencode/state/inferred/` and check if a previous scan exists.
2. If yes, copy current inferred files to `.opencode/state/snapshots/inferred-{ISO_DATE}/` as backup.
3. Confirm scan scope with the user: "Scanning project at [cwd]. Proceed? (y/n)"

### Step 2 — Discovery Scan

Use `glob`, `grep`, and `read` tools to scan the project. Do NOT infer relationships from filenames alone — read actual file contents.

**Scan targets (in order):**

1. **Package manifest** (`package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`)
   - Extract all dependencies with versions
   - Detect package manager (npm/yarn/pnpm/bun)
   - Identify lockfile path

2. **Route files** (look for: `pages/`, `app/`, `routes/`, `src/routes/`, `router.ts`, `_app.tsx`)
   - List all detected route paths
   - Note HTTP methods where visible
   - Flag orphan routes (no clear feature association)

3. **API endpoints** (look for: `api/`, `controllers/`, `handlers/`, `resolvers/`, `schema.graphql`)
   - List endpoint signatures

4. **Database migrations** (look for: `migrations/`, `db/migrate/`, `prisma/`, `drizzle/`)
   - Count migrations, note most recent

5. **Test files** (look for: `*.test.ts`, `*.spec.ts`, `*.test.tsx`, `__tests__/`)
   - Count test files, estimate coverage signal (files with tests vs total)

6. **Configuration files** (look for: `.env.example`, `docker-compose.yml`, `k8s/`, `Dockerfile`)
   - Note deployment targets and environment structure

7. **Import graph sampling** (read 5–10 core source files)
   - Identify which modules import which — use this for architecture graph edges
   - Do NOT fabricate edges from filenames

### Step 3 — Populate Inferred Registries

After scanning, write findings to inferred registries with proper confidence scoring.

#### Confidence Score Rules

| Evidence Quality | Score |
|-----------------|-------|
| File exists + content confirms feature is complete | 0.90–1.00 |
| Multiple files reference feature | 0.75–0.89 |
| Single file or partial implementation | 0.55–0.74 |
| Only filename suggests feature, not confirmed by reading | 0.40–0.54 |
| Purely speculative / inferred from naming convention | 0.00–0.39 |

**Never assign score above 0.60 without reading actual file content.**

#### Feature Entry Format

```json
{
  "feature_name": {
    "status": "detected",
    "confidence": 0.75,
    "verification_status": "unverified",
    "evidence": ["relative/path/to/file.ts", "another/file.ts"],
    "routes": ["/login", "/logout"],
    "components": [],
    "apis": [],
    "notes": "Detected auth middleware and login route. No logout handler found.",
    "inferred_at": "ISO_DATE",
    "inferred_by": "scan-state"
  }
}
```

#### Architecture Node Format

```json
{
  "id": "unique-slug",
  "type": "module|service|component|route|api|database|config",
  "name": "Human Name",
  "path": "relative/path/from/root",
  "pattern": null,
  "confidence": 0.80,
  "metadata": {}
}
```

#### Architecture Edge Format

```json
{
  "source": "node-id",
  "target": "node-id",
  "relationship": "imports|calls|depends_on|renders|routes_to|queries",
  "verified": false,
  "confidence": 0.70,
  "evidence": "src/app/page.tsx imports src/components/Header.tsx"
}
```

#### Dependency Entry Format

```json
{
  "package_name": {
    "current_version": "1.2.3",
    "latest_version": null,
    "wanted_version": null,
    "type": "production|development|peer",
    "health": "unknown",
    "last_checked": null,
    "cves": [],
    "notes": "Version health not yet checked. Run /audit dependencies."
  }
}
```

### Step 4 — Update project-health.json

Write preliminary (null) health scores with a note that full computation requires `/audit health`.
Update `last_updated` timestamp.

### Step 5 — Sync agent-capabilities.json

Read `agent-metadata.json` and sync the `agent_roles` map in `state/agents/agent-capabilities.json`.
Add new agents found in metadata; preserve existing capability augmentations.

### Step 6 — Summary Report

Print a summary:
```
/scan-state complete
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Features detected:        [N] (inferred, unverified)
  Architecture nodes:       [N]
  Architecture edges:       [N]
  Dependencies found:       [N]
  Average confidence:       [0.XX]
  Snapshot saved to:        .opencode/state/snapshots/...

  ⚠  [K] features below confidence 0.60 — review recommended
  ⚠  [M] routes with no feature association

  Next steps:
    Run /audit features   → verify feature registry
    Run /audit architecture → verify architecture graph
    Run /audit dependencies → check dependency health
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Constraints

- NEVER write to `verified/` — that path is off-limits for this command.
- NEVER fabricate state — if you cannot confirm something by reading files, lower confidence or omit.
- NEVER infer relationships from filenames alone — read the files.
- ALWAYS create a snapshot before overwriting a previous inferred scan.
- ALWAYS mark all entries with `"verification_status": "unverified"`.
