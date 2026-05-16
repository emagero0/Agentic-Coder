<#
.SYNOPSIS
  Standalone consolidation scanner -- detects metadata staleness, drift, and
  pending consolidations. NO API calls, NO LLM. Runs on file-system introspection only.

.DESCRIPTION
  Compares architecture graph metadata against actual file system state.
  Scans project-intelligence files for known contradiction patterns.
  Checks for stale directories, broken references, and sync gaps.
  Outputs structured JSON report to .opencode/events/outputs/consolidation-scan-{DATE}.json

.PARAMETER Quiet
  Suppress console output, just write the report file.

.EXAMPLE
  .\scripts\consolidation-scanner.ps1
  .\scripts\consolidation-scanner.ps1 -Quiet
#>

param([switch]$Quiet)

function Log { param([string]$Msg) if (-not $Quiet) { Write-Host $Msg } }

$Root = Resolve-Path "$PSScriptRoot\.."
$Today = (Get-Date -Format "yyyy-MM-dd")
$Timestamp = (Get-Date -Format "o")

Log "============================================"
Log " OAC Consolidation Scanner -- $Today"
Log "============================================"

# ---- Helper: safely read JSON ----
function Read-JsonFile {
    param([string]$RelPath)
    $full = Join-Path $Root $RelPath
    if (-not (Test-Path $full)) { return $null }
    try { return Get-Content $full -Raw | ConvertFrom-Json } catch { return $null }
}

# ---- Helper: count files by pattern ----
function Count-Files {
    param([string]$RelDir, [string]$Pattern = "*")
    $full = Join-Path $Root $RelDir
    if (-not (Test-Path $full)) { return 0 }
    return (Get-ChildItem -LiteralPath $full -Filter $Pattern -Recurse -File -Force -ErrorAction SilentlyContinue).Count
}

# ---- Helper: count directories ----
function Count-Dirs {
    param([string]$RelDir)
    $full = Join-Path $Root $RelDir
    if (-not (Test-Path $full)) { return 0 }
    return (Get-ChildItem -LiteralPath $full -Directory -Force -ErrorAction SilentlyContinue).Count
}

# ---- 1. Architecture Graph Metadata Checks ----
Log "`n[1] Architecture Graph Metadata Checks..."
$issues = @()
$allOk = $true

$infGraph = Read-JsonFile ".opencode\state\inferred\architecture\architecture-graph.json"
$verGraph = Read-JsonFile ".opencode\state\verified\architecture\architecture-graph.json"

if (-not $infGraph) { Log "  [SKIP] Inferred graph not found" }
if (-not $verGraph) { Log "  [SKIP] Verified graph not found" }

# Context system files count
$actualContextFiles = Count-Files ".opencode\context" "*.md"
$ctxNode = if ($verGraph) { $verGraph.nodes | Where-Object { $_.id -eq "context-system" } | Select-Object -First 1 } else { $null }
$graphCtxFiles = if ($ctxNode -and $ctxNode.metadata) { $ctxNode.metadata.files_count } else { $null }
if ($graphCtxFiles -and $graphCtxFiles -ne $actualContextFiles) {
    $issues += [PSCustomObject]@{ id="META-ctx-files"; severity="low"; item="context-system.files_count"; graphSays=$graphCtxFiles; actual=$actualContextFiles; file="architecture-graph.json (verified)" }
    Log "  [STALE] context-system.files_count: graph=$graphCtxFiles, actual=$actualContextFiles"
    $allOk = $false
} else { Log "  [OK] context-system.files_count: $actualContextFiles (matches)" }

# Agent count
$agentMetadataPath = Join-Path $Root ".opencode\config\agent-metadata.json"
$actualAgents = 0
if (Test-Path $agentMetadataPath) {
    $am = Get-Content $agentMetadataPath -Raw | ConvertFrom-Json
    if ($am.agents) { $actualAgents = ($am.agents.PSObject.Properties | Measure-Object).Count }
}
$agentNode = if ($verGraph) { $verGraph.nodes | Where-Object { $_.id -eq "agent-metadata" } | Select-Object -First 1 } else { $null }
$graphAgentCount = if ($agentNode -and $agentNode.metadata) { $agentNode.metadata.agents_count } else { $null }
if ($graphAgentCount -and $graphAgentCount -ne $actualAgents) {
    $issues += [PSCustomObject]@{ id="META-agents"; severity="medium"; item="agent-metadata.agents_count"; graphSays=$graphAgentCount; actual=$actualAgents; file="architecture-graph.json (verified)" }
    Log "  [STALE] agent-metadata.agents_count: graph=$graphAgentCount, actual=$actualAgents"
    $allOk = $false
} else { Log "  [OK] agent-metadata.agents_count: $actualAgents (matches)" }

# Inferred files count
$inferredDir = Join-Path $Root ".opencode\state\inferred"
$actualInferredFiles = 0
if (Test-Path $inferredDir) {
    $actualInferredFiles = (Get-ChildItem -LiteralPath $inferredDir -Recurse -File -Filter "*.json" -Force -ErrorAction SilentlyContinue).Count
}
$stateNode = if ($verGraph) { $verGraph.nodes | Where-Object { $_.id -eq "state-registry" } | Select-Object -First 1 } else { $null }
$graphInferredFiles = if ($stateNode -and $stateNode.metadata) { $stateNode.metadata.inferred_files } else { $null }
if ($graphInferredFiles -and $graphInferredFiles -ne $actualInferredFiles) {
    $issues += [PSCustomObject]@{ id="META-inferred-files"; severity="low"; item="state-registry.inferred_files"; graphSays=$graphInferredFiles; actual=$actualInferredFiles; file="architecture-graph.json (verified)" }
    Log "  [STALE] state-registry.inferred_files: graph=$graphInferredFiles, actual=$actualInferredFiles"
    $allOk = $false
} else { Log "  [OK] state-registry.inferred_files: $actualInferredFiles (matches)" }

# Command definitions count
$actualCmdFiles = Count-Files ".opencode\command" "*.md"
$cmdNode = if ($verGraph) { $verGraph.nodes | Where-Object { $_.id -eq "command-definitions" } | Select-Object -First 1 } else { $null }
$graphCmdCount = if ($cmdNode -and $cmdNode.metadata) { $cmdNode.metadata.files_count } else { $null }
if ($graphCmdCount -and $graphCmdCount -ne $actualCmdFiles) {
    $issues += [PSCustomObject]@{ id="META-cmd-files"; severity="low"; item="command-definitions.files_count"; graphSays=$graphCmdCount; actual=$actualCmdFiles; file="architecture-graph.json (verified)" }
    Log "  [STALE] command-definitions.files_count: graph=$graphCmdCount, actual=$actualCmdFiles"
    $allOk = $false
} else { Log "  [OK] command-definitions.files_count: $actualCmdFiles (matches)" }

# Skills tracking
$skillsDir = Join-Path $Root ".opencode\skills"
$actualSkillDirs = @()
if (Test-Path $skillsDir) { $actualSkillDirs = (Get-ChildItem -LiteralPath $skillsDir -Directory -Force -ErrorAction SilentlyContinue).Name }
$skillsNode = if ($verGraph) { $verGraph.nodes | Where-Object { $_.id -eq "skills-system" } | Select-Object -First 1 } else { $null }
$graphSkills = @()
if ($skillsNode -and $skillsNode.metadata -and $skillsNode.metadata.skills) { $graphSkills = @($skillsNode.metadata.skills) }
$missingSkills = $actualSkillDirs | Where-Object { $_ -notin $graphSkills }
if ($missingSkills) {
    $issues += [PSCustomObject]@{ id="META-skills"; severity="low"; item="skills-system.skills"; graphSays=($graphSkills -join ","); actual=($actualSkillDirs -join ","); missing=($missingSkills -join ","); file="architecture-graph.json (verified)" }
    Log "  [STALE] Untracked skills: $($missingSkills -join ', ')"
    $allOk = $false
} else { Log "  [OK] All skills tracked: $($actualSkillDirs -join ', ')" }

# Node ID consistency between graphs
if ($infGraph -and $verGraph) {
    $infIds = @($infGraph.nodes.id) | Sort-Object
    $verIds = @($verGraph.nodes.id) | Sort-Object
    $verOnly = Compare-Object $infIds $verIds | Where-Object { $_.SideIndicator -eq '=>' } | ForEach-Object { $_.InputObject }
    $infOnly = Compare-Object $infIds $verIds | Where-Object { $_.SideIndicator -eq '<=' } | ForEach-Object { $_.InputObject }
    if ($verOnly) { Log "  [INFO] Verified-only nodes: $($verOnly -join ', ')" }
    if ($infOnly) { Log "  [INFO] Inferred-only nodes: $($infOnly -join ', ')" }
    # Check for same name, different ID
    foreach ($vId in $verIds) {
        $vNode = $verGraph.nodes | Where-Object { $_.id -eq $vId } | Select-Object -First 1
        if (-not $vNode) { continue }
        $infMatch = $infGraph.nodes | Where-Object { $_.name -eq $vNode.name } | Select-Object -First 1
        if ($infMatch -and ($infMatch.id -ne $vId)) {
            $issues += [PSCustomObject]@{ id="META-node-id-$vId"; severity="medium"; item="node_id_mismatch"; inferredId=$infMatch.id; verifiedId=$vId; file="architecture-graph.json (both)" }
            Log "  [STALE] Node ID mismatch: inferred='$($infMatch.id)' vs verified='$vId' (name='$($vNode.name)')"
            $allOk = $false
        }
    }
}

# ---- 2. PI File Contradiction Checks ----
Log "`n[2] Project-Intelligence Contradiction Checks..."
$piDir = Join-Path $Root ".opencode\context\project-intelligence"
$piFiles = @{
    "technical-domain.md" = @(
        @{ pattern = "5\.8\.x"; label = "TS version 5.8.x (should be 6.0.x)" }
        @{ pattern = "1\.14\.46"; label = "@opencode-ai/plugin 1.14.46 (should be 1.14.48)" }
        @{ pattern = "TypeScript 5\.8\+"; label = "TS requirement 5.8+ (should be 6.0+)" }
    )
    "business-domain.md" = @(
        @{ pattern = "28 specialized agents"; label = "Agent count says 28 (should be 30)" }
    )
    "business-tech-bridge.md" = @(
        @{ pattern = "28 agents across 6 categories"; label = "Agent count says 28 (should be 30)" }
    )
    "living-notes.md" = @(
        @{ pattern = "In Progress.*this file included"; label = "Stale 'In Progress' status for PI population" }
        @{ pattern = "Jan 2026->2025"; label = "Confusing date text in known issues" }
    )
}

foreach ($file in $piFiles.Keys) {
    $fullPath = Join-Path $piDir $file
    if (-not (Test-Path $fullPath)) { continue }
    $content = Get-Content $fullPath -Raw
    foreach ($check in $piFiles[$file]) {
        if ($content -match $check.pattern) {
            $issues += [PSCustomObject]@{ id="PI-contra-$file"; severity="medium"; item="contradiction:$file"; detail=$check.label; file=".opencode/context/project-intelligence/$file" }
            Log "  [STALE] $file : $($check.label) -- STILL PRESENT"
            $allOk = $false
        }
    }
}

# ---- 3. Navigation Reference Checks ----
Log "`n[3] Navigation Reference Checks..."
$navPath = Join-Path $Root ".opencode\context\navigation.md"
if (Test-Path $navPath) {
    $navContent = Get-Content $navPath -Raw
    $refs = [regex]::Matches($navContent, '`([^`]+\.md)`') | ForEach-Object { $_.Groups[1].Value }
    $validCount = 0
    $brokenCount = 0
    foreach ($ref in $refs) {
        $resolved = Join-Path (Join-Path $Root ".opencode\context") $ref
        if (Test-Path $resolved) { $validCount++ } else {
            $brokenCount++
            $issues += [PSCustomObject]@{ id="NAV-broken-$ref"; severity="medium"; item="broken_nav_ref"; reference=$ref; file=".opencode/context/navigation.md" }
            Log "  [BROKEN] $ref"
            $allOk = $false
        }
    }
    if ($brokenCount -eq 0) { Log "  [OK] All $validCount navigation references valid" }
}

# ---- 4. Stale Directory Check ----
Log "`n[4] Stale Directory Check..."
$staleDirs = @(
    ".opencode\tool\events\adapters\runtime\bun",
    ".opencode\tool\events\handlers",
    ".opencode\tool\events\router"
)
foreach ($dir in $staleDirs) {
    $full = Join-Path $Root $dir
    if (Test-Path $full) {
        $issues += [PSCustomObject]@{ id="DIR-stale"; severity="low"; item="empty_directory"; path=$dir; file="filesystem" }
        Log "  [STALE] Directory still exists: $dir"
        $allOk = $false
    }
}
Log "  [OK] No stale directories found"

# ---- 5. Graph Orphan Check ----
Log "`n[5] Graph Orphan Check..."
if ($verGraph) {
    $allEdgeSources = @($verGraph.edges.source)
    $allEdgeTargets = @($verGraph.edges.target)
    $connectedNodes = ($allEdgeSources + $allEdgeTargets) | Select-Object -Unique
    $orphans = $verGraph.nodes | Where-Object { $_.id -notin $connectedNodes }
    if ($orphans) {
        foreach ($o in $orphans) {
            $issues += [PSCustomObject]@{ id="ORPHAN-$($o.id)"; severity="info"; item="orphan_node"; nodeId=$o.id; file="architecture-graph.json (verified)" }
        }
        Log "  [INFO] $($orphans.Count) orphan nodes: $($orphans.id -join ', ')"
    } else {
        Log "  [OK] No orphan nodes"
    }
}

# ---- 6. Agent Capability Sync Check ----
Log "`n[6] Agent Capability Sync Check..."
$capsPath = Join-Path $Root ".opencode\state\agents\agent-capabilities.json"
if (Test-Path $capsPath) {
    $caps = Get-Content $capsPath -Raw | ConvertFrom-Json
    $capsAgentIds = @($caps.agent_roles.PSObject.Properties.Name)
    $metaAgentIds = @()
    if (Test-Path $agentMetadataPath) {
        $am = Get-Content $agentMetadataPath -Raw | ConvertFrom-Json
        if ($am.agents) { $metaAgentIds = @($am.agents.PSObject.Properties.Name) }
    }
    $missingInCaps = $metaAgentIds | Where-Object { $_ -notin $capsAgentIds }
    if ($missingInCaps) {
        $issues += [PSCustomObject]@{ id="CAP-missing"; severity="medium"; item="missing_in_capabilities"; agents=($missingInCaps -join ","); file=".opencode/state/agents/agent-capabilities.json" }
        Log "  [STALE] $($missingInCaps.Count) agents missing from capabilities: $($missingInCaps -join ', ')"
        $allOk = $false
    } else {
        Log "  [OK] All $($metaAgentIds.Count) agents present in capabilities"
    }
}

# ---- 7. Graphify Graph Cross-Reference ----
Log "`n[7] Graphify Graph Check..."
$gJson = Join-Path $Root "graphify-out\graph.json"
$gReport = Join-Path $Root "graphify-out\GRAPH_REPORT.md"
if (Test-Path $gJson) {
    $gSize = (Get-Item $gJson).Length
    $gMod = (Get-Item $gJson).LastWriteTime.ToString("yyyy-MM-dd")
    Log "  [INFO] Graphify graph exists ($(($gSize/1KB -as [int])) KB, built $gMod)"

    if (Test-Path $gReport) {
        $rc = Get-Content $gReport -Raw
        if ($rc -match 'isolated') {
            $iso = "some"
            $m = [regex]::Match($rc, '(\d+)\s*isolated')
            if ($m.Success) { $iso = $m.Groups[1].Value }
            $issues += [PSCustomObject]@{ id="GRAPHIFY-orphans"; severity="info"; item="graphify_isolated_nodes"; detail="${iso} isolated nodes in graphify graph"; file="graphify-out/graph.json" }
            Log "  [INFO] Graphify reports $iso isolated nodes (potential orphans)"
        }
    }
} else {
    Log "  [SKIP] No graphify graph -- run /graphify ."
    $issues += [PSCustomObject]@{ id="GRAPHIFY-not-built"; severity="info"; item="graphify_not_built"; detail="run /graphify . to enable code-level analysis"; file="N/A" }
}

# ---- Report ----
$report = [PSCustomObject]@{
    scan_timestamp = $Timestamp
    scan_date = $Today
    all_checks_passed = (@($issues | Where-Object { $_.severity -ne "info" }).Count -eq 0)
    total_issues = $issues.Count
    actionable_issues = @($issues | Where-Object { $_.severity -ne "info" }).Count
    issues = $issues | Sort-Object severity, id
    summary = [PSCustomObject]@{
        metadata_stale = @($issues | Where-Object { $_ -and ($_.id -like "META-*") }).Count
        contradictions = @($issues | Where-Object { $_ -and ($_.id -like "PI-*") }).Count
        broken_nav_refs = @($issues | Where-Object { $_ -and ($_.id -like "NAV-*") }).Count
        stale_dirs = @($issues | Where-Object { $_ -and ($_.id -like "DIR-*") }).Count
        orphan_nodes = @($issues | Where-Object { $_ -and ($_.id -like "ORPHAN-*") }).Count
        capability_gaps = @($issues | Where-Object { $_ -and ($_.id -like "CAP-*") }).Count
        graphify_issues = @($issues | Where-Object { $_ -and ($_.id -like "GRAPHIFY-*") }).Count
        graphify_built = (Test-Path (Join-Path $Root "graphify-out\graph.json"))
    }
}

# Write report
$outputDir = Join-Path $Root ".opencode\events\outputs"
if (-not (Test-Path $outputDir)) { New-Item -ItemType Directory -Path $outputDir -Force | Out-Null }
$reportFile = Join-Path $outputDir "consolidation-scan-$Today.json"
$report | ConvertTo-Json -Depth 6 | Set-Content $reportFile -Encoding UTF8
Log "`nReport written: .opencode/events/outputs/consolidation-scan-$Today.json"

# Write pending tracking file
$pendingIssues = @($issues | ForEach-Object {
    [PSCustomObject]@{
        id = $_.id
        severity = $_.severity
        item = if ($_.item) { $_.item } else { if ($_.detail) { $_.detail } else { $_.id } }
        file = $_.file
        status = "pending"
        detected_at = $Timestamp
    }
})

$pendingTrack = [PSCustomObject]@{
    last_scan = $Timestamp
    scan_file = "consolidation-scan-$Today.json"
    total_issues = $issues.Count
    issues = $pendingIssues
}
$pendingFile = Join-Path $Root ".opencode\config\consolidation-pending.json"
$pendingTrack | ConvertTo-Json -Depth 6 | Set-Content $pendingFile -Encoding UTF8
Log "Pending tracking: .opencode/config/consolidation-pending.json"

# ---- Summary ----
$actionableIssues = @($issues | Where-Object { $_.severity -ne "info" }).Count
$realOk = ($actionableIssues -eq 0)
Log ""
Log "============================================"
if ($realOk) {
    Log " RESULT: ALL CHECKS PASSED -- system is in sync"
    if (@($issues | Where-Object { $_.severity -eq "info" }).Count -gt 0) {
        Log "   (info items: $(@($issues | Where-Object { $_.severity -eq "info" }).Count))"
    }
} else {
    Log " RESULT: $actionableIssues ISSUE(S) DETECTED"
    Log "   Metadata stale:   $(@($issues | Where-Object { $_.id -like 'META-*' }).Count)"
    Log "   Contradictions:   $(@($issues | Where-Object { $_.id -like 'PI-*' }).Count)"
    Log "   Broken nav refs:  $(@($issues | Where-Object { $_.id -like 'NAV-*' }).Count)"
    Log "   Stale dirs:       $(@($issues | Where-Object { $_.id -like 'DIR-*' }).Count)"
    Log "   Capability gaps:  $(@($issues | Where-Object { $_.id -like 'CAP-*' }).Count)"
}
$infoCount = @($issues | Where-Object { $_.severity -eq "info" }).Count
$gfIssues = @($issues | Where-Object { $_.id -like 'GRAPHIFY-*' }).Count
if ($infoCount -gt 0) {
    $extra = if ($gfIssues -gt 0) { ", graphify: $gfIssues" } else { "" }
    Log "   Info items:       $infoCount (orphan nodes, standalone modules$extra)"
}
Log "============================================"

return $report
