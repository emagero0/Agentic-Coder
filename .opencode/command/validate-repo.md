# Validate Repository

Comprehensive validation command that checks the entire OpenAgents Control repository for consistency between CLI, documentation, registry, and components.

## Usage

```bash
/validate-repo
```

## What It Checks

This command performs a comprehensive validation of:

1. **Registry Integrity**
   - JSON syntax validation
   - Component definitions completeness
   - File path references
   - Dependency declarations

2. **Component Existence**
   - All agents exist at specified paths
   - All subagents exist at specified paths
   - All commands exist at specified paths
   - All tools exist at specified paths
   - All plugins exist at specified paths
   - All context files exist at specified paths
   - All config files exist at specified paths

3. **Profile Consistency**
   - Component counts match documentation
   - Profile descriptions are accurate
   - Dependencies are satisfied
   - No duplicate components

4. **Documentation Accuracy**
   - README component counts match registry
   - OpenAgent documentation references are valid
   - Context file references are correct
   - Installation guide is up to date

5. **Context File Structure**
   - All referenced context files exist
   - Context file organization is correct
   - No orphaned context files

6. **Cross-References**
   - Agent dependencies exist
   - Subagent references are valid
   - Command references are valid
   - Tool dependencies are satisfied

## Output

The command generates a detailed report showing:
- ✅ What's correct and validated
- ⚠️ Warnings for potential issues
- ❌ Errors that need fixing
- 📊 Summary statistics

## Instructions

You are a validation specialist. Your task is to comprehensively validate the OpenAgents Control repository for consistency and correctness.

### Step 1: Validate Registry JSON

1. Read and parse `registry.json`
2. Validate JSON syntax
3. Check schema structure:
   - `version` field exists
   - `repository` field exists
   - `categories` object exists
   - `components` object exists with all types
   - `profiles` object exists
   - `metadata` object exists

### Step 2: Validate Component Definitions

For each component type (agents, subagents, commands, tools, plugins, contexts, config):

1. Check required fields:
   - `id` (unique)
   - `name`
   - `type`
   - `path`
   - `description`
   - `tags` (array)
   - `dependencies` (array)
   - `category`

2. Verify file exists at `path`
3. Check for duplicate IDs
4. Validate category is in defined categories

### Step 3: Validate Profiles

For each profile (essential, developer, business, full, advanced):

1. Count components in profile
2. Verify all component references exist in components section
3. Check dependencies are satisfied
4. Validate no duplicate components

### Step 4: Cross-Reference with Documentation

1. **navigation.md**:
   - Extract component counts from profile descriptions
   - Compare with actual registry counts
   - Check profile descriptions match registry descriptions

2. **docs/agents/openagent.md**:
   - Verify delegation criteria mentioned
   - Check context file references
   - Validate workflow descriptions

3. **docs/getting-started/installation.md**:
   - Check profile descriptions
   - Verify installation commands

### Step 5: Validate Context File Structure

1. List all files in `.opencode/context/`
2. Check against registry context entries
3. Identify orphaned files (exist but not in registry)
4. Identify missing files (in registry but don't exist)
5. Validate structure:
   - `core/standards/` files
   - `core/workflows/` files
   - `core/system/` files
   - `project/` files

### Step 6: Validate Dependencies

For each component with dependencies:

1. Parse dependency string (format: `type:id`)
2. Verify referenced component exists
3. Check for circular dependencies
4. Validate dependency chain completeness

### Step 7: Generate Report

Create a comprehensive report with sections:

#### ✅ Validated Successfully
- Registry JSON syntax
- Component file existence
- Profile integrity
- Documentation accuracy
- Context file structure
- Dependency chains

#### ⚠️ Warnings
- Orphaned files (exist but not referenced)
- Unused components (defined but not in any profile)
- Missing descriptions or tags
- Outdated metadata dates

#### ❌ Errors
- Missing files
- Broken dependencies
- Invalid JSON
- Component count mismatches
- Broken documentation references
- Duplicate component IDs

#### 📊 Statistics
- Total components: X
- Total profiles: X
- Total context files: X
- Components per profile breakdown
- File coverage percentage

### Step 8: Provide Recommendations

Based on findings, suggest:
- Files to create
- Registry entries to add/remove
- Documentation to update
- Dependencies to fix

## Output format (compact)
```
# Validation Report
## Summary: X% pass, Y warnings, Z errors
## Errors (list: component, issue, action)
## Warnings (list: component, issue, recommendation)
## Stats: {total, found, missing, orphans, broken deps}
## Actions: {prioritized list}
```

No emoji headers, no box-drawing. Report sections as flat lists only.
