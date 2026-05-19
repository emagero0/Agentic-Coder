---
description: Validate context file dependencies across agents and registry
tags:
  - registry
  - validation
  - context
  - dependencies
  - openagents
dependencies:
  - command:analyze-patterns
---

# Check Context Dependencies

**Purpose**: Ensure agents properly declare their context file dependencies in frontmatter and registry.

**Arguments**: `$ARGUMENTS`

---

## What It Does

Validates consistency between:
1. **Actual usage** - Context files referenced in agent prompts
2. **Declared dependencies** - Dependencies in agent frontmatter
3. **Registry entries** - Dependencies in registry.json

**Identifies**:
- ✅ Missing dependency declarations (agents use context but don't declare it)
- ✅ Unused context files (exist but no agent references them)
- ✅ Broken references (referenced but don't exist)
- ✅ Format inconsistencies (wrong dependency format)

---

## Usage

```bash
# Analyze all agents
/check-context-deps

# Analyze specific agent
/check-context-deps contextscout

# Auto-fix missing dependencies
/check-context-deps --fix

# Verbose output (show all reference locations)
/check-context-deps --verbose

# Combine flags
/check-context-deps contextscout --verbose
```

---

## Workflow

1. **ScanAgents**: Search `.opencode/agent/**/*.md` and `.opencode/command/**/*.md` for context references (paths, @-refs, frontmatter deps). Extract agent ID, context path, line number, ref type.
2. **CheckRegistry**: For each agent, verify `registry.json` has matching `dependencies` entries. Check format: `context:path/to/file`.
3. **ValidateContextFiles**: For each referenced context, verify file exists on disk and is in registry. Flag orphans and missing files.
4. **Report**: For each agent list: agent ID, context files used but not declared, recommended fix. Include usage frequency map (file | agents | count). Flag orphans and missing.

5. **Fix** (`--fix`): Read agent file, parse frontmatter, add missing context deps, preserve existing, show diff.

## Report format (compact)
```
## Summary: {agents scanned}, {refs found}, {missing deps}, {orphans}
## Missing Dependencies
- {agent}: {context paths} → recommended fix: add to frontmatter
## Unused: {context files with 0 refs}
## Missing Files: {referenced but not on disk}
## Usage Map: {context file} | {agents} | {count}
```

### Search Patterns

**Find direct path references**:
```bash
grep -rn "\.opencode/context/" .opencode/agent/ .opencode/command/
```

**Find @ references**:
```bash
grep -rn "@\.opencode/context/" .opencode/agent/ .opencode/command/
```

**Find dependency declarations**:
```bash
grep -rn "^\s*-\s*context:" .opencode/agent/ .opencode/command/
```

### Path Normalization

**Convert to dependency format**:
- `.opencode/context/core/standards/code-quality.md` → `context:core/standards/code`
- `@.opencode/context/openagents-repo/quick-start.md` → `context:openagents-repo/quick-start`
- `context/core/standards/code` → `context:core/standards/code`

**Rules**:
1. Strip `.opencode/` prefix
2. Strip `.md` extension
3. Add `context:` prefix for dependencies

### Registry Lookup

**Check if context file is in registry**:
```bash
jq '.components.contexts[] | select(.id == "core/standards/code")' registry.json
```

**Get agent dependencies**:
```bash
jq '.components.agents[] | select(.id == "opencoder") | .dependencies[]?' registry.json
```

---

## Delegation

This command delegates to an analysis agent to perform the work:

```javascript
task(
  subagent_type="PatternAnalyst",
  description="Analyze context dependencies",
  prompt=`
    Analyze context file usage across all agents in this repository.
    
    TASK:
    1. Use grep to find all references to context files in:
       - .opencode/agent/**/*.md
       - .opencode/command/**/*.md
    
    2. Search for these patterns:
       - ".opencode/context/core/" (direct paths)
       - "@.opencode/context/" (@ references)
       - "context:" in frontmatter (dependency declarations)
    
    3. For each agent file found:
       - Extract agent ID from frontmatter
       - List all context files it references
       - Check registry.json for declared dependencies
       - Identify missing dependency declarations
    
    4. For each context file in .opencode/context/core/:
       - Count how many agents reference it
       - Check if it exists in registry.json
       - Identify unused context files
    
    5. Generate a comprehensive report showing:
       - Agents with missing context dependencies
       - Unused context files
       - Missing context files (referenced but don't exist)
       - Context file usage map (which agents use which files)
    
    ${ARGUMENTS.includes('--fix') ? `
    6. AUTO-FIX MODE:
       - Update agent frontmatter to add missing context dependencies
       - Use format: context:core/standards/code
       - Preserve existing dependencies
       - Show what was changed
    ` : ''}
    
    ${ARGUMENTS.includes('--verbose') ? `
    VERBOSE MODE: Include all reference locations (file:line) in report
    ` : ''}
    
    ${ARGUMENTS.length > 0 && !ARGUMENTS.includes('--') ? `
    FILTER: Only analyze agent: ${ARGUMENTS[0]}
    ` : ''}
    
    REPORT FORMAT:
    - Summary statistics
    - Missing dependencies by agent (with recommended fixes)
    - Unused context files
    - Context file usage map
    - Next steps
    
    DO NOT make changes without --fix flag.
    ALWAYS show what would be changed before applying fixes.
  `
)
```

---

## Examples

### Example 1: Basic Analysis

```bash
/check-context-deps
```

**Output**:
```
Analyzing context file usage across 25 agents...

Found 8 agents with missing context dependencies:
- opencoder: missing context:core/standards/code
- openagent: missing 5 context dependencies
- frontend-specialist: missing context:core/standards/code
...

Run /check-context-deps --fix to auto-update frontmatter
```

### Example 2: Analyze Specific Agent

```bash
/check-context-deps contextscout
```

**Output**:
```
Analyzing agent: contextscout

Context files referenced:
✓ .opencode/context/core/context-system.md (1 reference)
  - Line 15: "Load: context:core/context-system"
✓ .opencode/context/core/context-system/standards/mvi.md (2 references)
  - Line 16: "Load: context:core/context-system/standards/mvi"
  - Line 89: "MVI-aware prioritization"

Registry dependencies:
✓ context:core/context-system DECLARED
✓ context:core/context-system/standards/mvi DECLARED

All dependencies properly declared ✅
```

### Example 3: Auto-Fix

```bash
/check-context-deps --fix
```

**Output**:
```
Analyzing and fixing context dependencies...

Updated opencoder:
+ Added: context:core/standards/code

Updated openagent:
+ Added: context:core/standards/code
+ Added: context:core/standards/docs
+ Added: context:core/standards/tests
+ Added: context:core/workflows/review
+ Added: context:core/workflows/delegation

Total: 2 agents updated, 6 dependencies added

Next: Run ./scripts/registry/auto-detect-components.sh to update registry
```

---

## Success Criteria

✅ All agents that reference context files have them declared in dependencies
✅ All context files in registry are actually used by at least one agent
✅ No broken references (context files referenced but don't exist)
✅ Dependency format is consistent (`context:path/to/file`)

---

## Notes

- **Read-only by default** - Only reports findings, doesn't modify files
- **Use `--fix` to update** - Auto-adds missing dependencies to frontmatter
- **After fixing** - Run `./scripts/registry/auto-detect-components.sh --auto-add` to sync registry
- **Dependency format** - `context:path/to/file` (no `.opencode/` prefix, no `.md` extension)
- **Scans both** - Direct path references and @ references

## Related

- **Registry validation**: `./scripts/registry/validate-registry.sh`
- **Auto-detect components**: `./scripts/registry/auto-detect-components.sh`
- **Context guide**: `.opencode/context/openagents-repo/quality/registry-dependencies.md`
