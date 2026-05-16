# OpenCode System Guide

**Purpose**: Complete reference for understanding and using OpenCode  
**Version**: 1.0 | **Updated**: 2026-05-12 | **Priority**: critical

---

## Quick Reference

| Item | Value |
|------|-------|
| **Name** | OpenAgent |
| **Model** | minimax-m2.5-free |
| **Platform** | win32 (PowerShell) |
| **Workspace Root** | / |
| **Git Repo** | No (by default) |
| **Context Index** | `.opencode/context/navigation.md` |
| **Execution Priority** | Safety → Workflow → Optimization |

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [System Architecture](#2-system-architecture)
3. [Context System](#3-context-system)
4. [Skills System](#4-skills-system)
5. [Execution Workflows](#5-execution-workflows)
6. [Tutorials](#6-tutorials)
7. [Best Practices](#7-best-practices)
8. [Troubleshooting](#8-troubleshooting)
9. [Configuration Reference](#9-configuration-reference)

---

# 1. Introduction

## What is OpenCode?

OpenCode is a universal AI agent system designed for **code, documentation, tests, and workflow coordination**. It operates as a hierarchical agent architecture with specialized subagents for different tasks.

### Core Capabilities

| Capability | Description |
|------------|-------------|
| **Code Writing** | Implement features, fix bugs, refactor with CoderAgent |
| **Code Review** | Security checks, quality assurance with CodeReviewer |
| **Test Authoring** | TDD, test coverage with TestEngineer |
| **Documentation** | docs, READMEs, specs with DocWriter |
| **Task Management** | Break down complex features with TaskManager |
| **Build Validation** | Type checking, build verification with BuildAgent |
| **Context Discovery** | Find project standards with ContextScout |
| **External Docs** | Live library documentation via Context7 |

### Getting Started

**Step 1**: Know your execution paths

```
Questions (no action)    → Conversational path (no approval needed)
Actions (write/edit/run) → Task path (requires approval)
```

**Step 2**: Remember the core principles

| Principle | What It Means |
|-----------|---------------|
| **Safety First** | Always check permissions, load context, use approval gates |
| **Report Before Fix** | Never auto-fix; report issues and wait for approval |
| **Context-First** | Always discover project standards before writing |
| **Lean** | Concise responses; if it can't be understood in <30s, it's too long |

**Step 3**: Know when to delegate

| Task Type | Use Agent |
|-----------|-----------|
| Writing code | `CoderAgent` |
| Reviewing code | `CodeReviewer` |
| Writing tests | `TestEngineer` |
| Creating docs | `DocWriter` |
| Breaking down features | `TaskManager` |
| Finding project standards | `ContextScout` |
| Finding library docs | `context7` skill |
| Exploring codebase | `explore` subagent |

---

# 2. System Architecture

## How OpenCode Actually Works (Internals)

This section explains the **internal mechanics** of how agents behave, make decisions, and interact - not just their purpose.

### The Message Processing Pipeline

```
User Input
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│                    MESSAGE PARSING LAYER                        │
│  - Detect trigger type (question vs action)                    │
│  - Extract intent from natural language                         │
│  - Identify required capabilities                               │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                   CONTEXT DISCOVERY PHASE                      │
│  1. ContextScout runs (EXEMPT from approval)                   │
│  2. Reads navigation.md → finds relevant context paths         │
│  3. Loads priority context files based on task type            │
│  4. Builds contextual memory for the session                    │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                   EXECUTION DECISION POINT                      │
│                                                                  │
│  IF conversational (pure_question_no_exec):                     │
│    → Direct response, no approval gate                          │
│                                                                  │
│  IF task (bash|write|edit|task):                               │
│    → Load task-execution.md + context-loading.md                │
│    → Run approval-gates check                                  │
│    → Present proposal (read-only)                              │
│    → WAIT for user approval                                    │
│    → Execute ONLY after approval                              │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                   AGENT DELEGATION ENGINE                      │
│                                                                  │
│  Routes task to appropriate agent based on:                     │
│  - Task type (code, review, test, docs, etc.)                    │
│  - Complexity level (simple → medium → complex)                 │
│  - Required capabilities                                        │
│  - Agent availability                                            │
│                                                                  │
│  Delegation pattern:                                            │
│  - Simple: OpenAgent handles directly                           │
│  - Medium: Single specialist agent                             │
│  - Complex: TaskManager breaks down → multiple agents          │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                   VALIDATION & REPORTING                        │
│                                                                  │
│  1. BuildAgent validates syntax/types                          │
│  2. Run tests if applicable                                     │
│  3. Check against standards (ContextScout loaded)               │
│  4. Report results to user                                      │
│  5. Cleanup session if applicable                              │
└─────────────────────────────────────────────────────────────────┘
```

### Agent Behavior Modes

Each agent has specific **behavior modes** that define how they operate:

| Agent | Behavior Mode | Internal Loop |
|-------|---------------|---------------|
| **OpenAgent** | Orchestration | Analyze → Route → Monitor → Report |
| **CoderAgent** | Sequential Implementation | Read context → Implement → Validate → Refine |
| **CodeReviewer** | Checklist-based | Scan → Compare to standards → Flag issues → Report |
| **TestEngineer** | TDD Cycle | Write test → Run → Implement → Run → Coverage check |
| **TaskManager** | Decomposition | Analyze requirement → Break into tasks → Track dependencies |
| **ContextScout** | Discovery | Read navigation → Match patterns → Return paths |
| **ExternalScout** | Fetch-then-cache | Query API → Store in .tmp/external-context/ → Return |

### Supervisor Internal Mechanics

Supervisors don't execute tasks - they **monitor and guide** the primary agent's decisions:

#### meta-supervisor

```
Purpose: Ensures overall system coherence

Internal Behavior:
1. MONITOR: Watches agent interactions for coordination issues
2. VALIDATE: Checks that delegations follow correct patterns
3. INTERVENE: Flags when execution drifts from optimal path
4. REPORT: Provides oversight summary to OpenAgent

Trigger Conditions:
- Complex multi-agent tasks
- Cross-domain requests (code + docs + tests)
- Potential deadlock situations
```

#### architecture-supervisor

```
Purpose: Pattern governance, preventing technical debt accumulation

Internal Behavior:
1. SCAN: Compares new code against established patterns
2. DETECT: Identifies drift from conventions
3. FLAG: Reports naming inconsistencies, structural issues
4. SUGGEST: Proposes refactoring patterns

Detection Areas:
- Naming convention violations
- Structural divergence from project patterns
- Architectural anti-patterns
- Inconsistent error handling

Output Format:
- severity: critical|warning|suggestion
- location: file:line
- pattern_mismatch: what was expected vs what was found
- recommendation: suggested fix
```

#### memory-curator

```
Purpose: Maintains context hygiene, prevents information bloat

Internal Behavior:
1. TRACK: Monitors context files created/modified
2. DEDUPLICATE: Identifies redundant information
3. CONSOLIDATE: Merges related context files
4. CLEAN: Removes stale context
5. SYNC: Maintains agent-capabilities.json

Key Files Managed:
- .opencode/context/ memory index
- agent-capabilities.json (agent metadata registry)
- Session context files (.tmp/sessions/)

Cleanup Triggers:
- Session completed
- Context files older than threshold
- Redundant information detected
```

#### project-manager-supervisor

```
Purpose: Feature auditing, route analysis, product coherence

Internal Behavior:
1. AUDIT: Analyzes project structure and quality
2. TRACK: Monitors feature development progress
3. ANALYZE: Identifies route dependencies and blockers
4. REPORT: Provides project health metrics

Operating Modes:
- AUTOMATIC (lightweight): Runs on task completion, checks progress
- DEMAND (deep): Triggered by /audit commands, full analysis

Audit Dimensions:
- Code quality metrics
- Test coverage analysis
- Dependency health
- Documentation completeness
- Build health
```

#### rnd-supervisor

```
Purpose: Research & Development tracking, knowledge management

Internal Behavior:
1. TRACK: Monitors R&D activities and discoveries
2. CATALOG: Stores findings in accessible format
3. LINK: Connects related R&D topics
4. REPORT: Summarizes research status

What It Tracks:
- External libraries investigated (via ExternalScout)
- Patterns discovered during exploration
- Experimental approaches attempted
- Technology evaluations completed

Storage Pattern:
.tmp/rnd/
├── investigations/
│   ├── {date}-{topic}/
│   │   ├── findings.md
│   │   ├── examples/
│   │   └── verdict.md
├── experiments/
│   └── {experiment-name}/
└── knowledge-base/
    └── topics/
```

### R&D Supervisor Deep Dive

The `rnd-supervisor` is specifically designed for **knowledge management and research tracking**. Here's how it operates:

#### When It Activates

| Trigger | Action |
|---------|--------|
| ExternalScout fetches docs | Catalog library, store findings |
| explore agent discovers patterns | Track in knowledge base |
| User asks about "best way to..." | Check R&D cache first |
| New technology evaluation | Create investigation folder |
| Experiment attempted | Log to experiments/ |

#### R&D Workflow

```
1. RESEARCH REQUEST
   User: "What's the best way to handle state in React?"
   
2. RND CACHE CHECK
   rnd-supervisor: "Found prior investigation in .tmp/rnd/knowledge-base/react-state/"
   → Return cached findings
   
3. NEW INVESTIGATION (if no cache)
   Create: .tmp/rnd/investigations/2026-05-12-react-state/
   
4. EXECUTE RESEARCH
   - ExternalScout: Fetch React docs, Redux, Zustand, etc.
   - explore: Find patterns in codebase
   - Compare approaches
   
5. CATALOG FINDINGS
   verdicts.md:
   ---
   ## React State Management Comparison
   
   | Library | Pros | Cons | Best For |
   |---------|------|------|----------|
   | useState | Simple, built-in | Prop drilling | Local state |
   | Context | Shared state | Re-render issues | Theme, auth |
   | Redux | Predictable | Boilerplate | Large apps |
   | Zustand | Minimal, fast | Less ecosystem | Medium apps |
   
   ## Recommendation
   - Local state: useState
   - Shared (small app): Context
   - Shared (large app): Zustand or Redux Toolkit
   
   ## Rationale
   [Detailed reasoning...]
   ---
   
6. LINK TO KNOWLEDGE BASE
   - Update .tmp/rnd/knowledge-base/topics/react-state.md
   - Cross-link: react, performance, frontend
```

#### R&D Memory Structure

```
.tmp/rnd/
├── investigations/           # Detailed research logs
│   ├── 2026-05-12-orm-comparison/
│   │   ├── context.md        # Research parameters
│   │   ├── findings.md       # Raw findings
│   │   ├── comparison.md     # Comparison analysis
│   │   └── verdict.md        # Final recommendation
│   └── 2026-05-10-auth-patterns/
│       └── ...
├── experiments/              # Attempted solutions
│   ├── zustand-test/
│   │   ├── setup.md
│   │   ├── results.md
│   │   └── conclusion.md
│   └── graphql-migration/
│       └── ...
├── knowledge-base/           # Consolidated knowledge
│   ├── topics/
│   │   ├── react.md          # Tags: frontend, react, state
│   │   ├── database.md       # Tags: backend, data, orm
│   │   └── api-design.md     # Tags: backend, rest, graphql
│   └── tags/
│       ├── frontend.json     # Links to all frontend topics
│       ├── backend.json
│       └── testing.json
└── rnd-status.json           # Current research status
```

#### R&D Agent Interaction

```
┌─────────────────────────────────────────────────────────────────┐
│              R&D Supervisor Behavior Flow                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  REQUEST → Check cache → [Found?] → YES → Return cached        │
│                        ↓ NO                                     │
│                   Start investigation                           │
│                        ↓                                        │
│                   ExternalScout (fetch docs)                   │
│                   Explore (find patterns)                      │
│                   General (analyze options)                    │
│                        ↓                                        │
│                   Catalog findings                              │
│                        ↓                                        │
│                   Update knowledge base                        │
│                        ↓                                        │
│                   Report to user + cache for future            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Agent Self-Correction Mechanism

Agents can self-correct during execution:

```
SELF-CORRECTION FLOW:

1. AGENT DETECTS ISSUE
   CoderAgent: "Expected pattern not found in codebase"
   
2. PAUSE AND ASSESS
   - Is this a context problem? → Re-run ContextScout
   - Is this a capability issue? → Request help from OpenAgent
   - Is this an edge case? → Document and proceed with best guess
   
3. CORRECT APPROACH
   Context issue → Load correct context, retry
   Unknown pattern → Ask user for clarification
   Edge case → Implement conservatively, flag for review
   
4. CONTINUE OR ESCALATE
   Success → Continue execution
   Repeated failure → Escalate to OpenAgent
```

### Pattern Enforcement Behavior

```
ARCHITECTURE SUPERVISOR PATTERN ENFORCEMENT:

1. CODE GENERATED BY CODERAGENT
   ↓
2. ARCHITECTURE SUPERVISOR SCANS
   - Compare against .opencode/context/core/standards/
   - Check naming conventions
   - Verify structure matches patterns
   - Look for anti-patterns
   
3. ISSUE DETECTED?
   YES → Flag with location, expected pattern, recommendation
   NO → Continue
   
4. REPORT PATTERNS TO USER
   Format:
   ## Pattern Analysis
   
   ### ✅ Matches Standards
   - src/utils/format.ts: follows naming convention
   
   ### ⚠️ Deviations Found
   - src/components/UserCard.tsx:145
     Expected: PascalCase for components
     Found: camelCase function name
     Recommendation: Rename to UserCardActions
   
   ### 🔴 Anti-Patterns
   - src/services/auth.ts:78
     Issue: Nested callbacks (callback hell)
     Recommendation: Use async/await with proper error handling
```

### Multi-Agent Coordination Patterns

```
COORDINATION PATTERN 1: Sequential Handoff

Task: Write API → Add Tests → Document
Agent 1 (CoderAgent) → Agent 2 (TestEngineer) → Agent 3 (DocWriter)
     ↓                       ↓                        ↓
  Completes              Waits for                  Waits for
  API code               Agent 1 output             Agent 2 output
                          ↓                          ↓
                       Uses Agent 1               Uses Agent 1 & 2
                       output as input            output as input

COORDINATION PATTERN 2: Parallel Execution

Task: Build dashboard with multiple widgets
Session created → TaskManager breaks down

┌─────────────────────────────────────────────────┐
│              Parallel Agents                     │
│                                                 │
│   Widget1 ←──┐                                  │
│   Widget2 ←──┼→ Dashboard Assembly ← CoderAgent│
│   Widget3 ←──┤                                  │
│   API Layer ←┘                                  │
│                                                 │
└─────────────────────────────────────────────────┘

Widget agents work in parallel
CoderAgent assembles when all complete

COORDINATION PATTERN 3: Expert Review

Task: Security-critical feature
CoderAgent implements → CodeReviewer reviews → 
  [Issues?] → YES → CoderAgent fixes → CodeReviewer re-reviews
           → NO → Continue

COORDINATION PATTERN 4: Iterative Refinement

Task: Complex algorithm
CoderAgent (v1) → TestEngineer → [Tests fail?] → 
  YES → CoderAgent (v2) → TestEngineer → ...
  NO → CodeReviewer → [Review issues?] →
    YES → CoderAgent (v3) → ...
    NO → Done
```

---

## Agent Hierarchy

#### graph-query-engine

```
Purpose: Graph-based query handling for complex relationships

Internal Behavior:
1. BUILD: Constructs knowledge graphs from context
2. QUERY: Processes relationship-based queries
3. TRAVERSE: Navigates complex dependencies
4. RESOLVE: Answers multi-hop questions

Use Cases:
- "What depends on this module?"
- "Find all code related to feature X"
- "Trace the data flow from A to B"
- "What tests cover this functionality?"

Query Types:
- DIRECT: Single relationship lookup
- INDIRECT: Multi-hop traversal
- AGGREGATE: Pattern-based collection queries
```

### Internal Communication Patterns

```
┌──────────────────────────────────────────────────────────────────┐
│                    AGENT MESSAGE FORMAT                          │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  TO: target-agent                                                │
│  FROM: OpenAgent                                                 │
│  TYPE: task|query|response|error                                 │
│  SESSION: {session-id}                                           │
│  PRIORITY: high|normal|low                                       │
│                                                                  │
│  CONTENT:                                                        │
│  - Task description                                              │
│  - Context files (paths to load)                                │
│  - Reference files                                               │
│  - Exit criteria                                                 │
│  - Constraints                                                   │
│                                                                  │
│  RESPONSE FORMAT:                                                │
│  - Status: success|partial|failure                               │
│  - Output: results                                               │
│  - Issues: problems encountered                                  │
│  - Next: suggested follow-up actions                             │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### State Management

Agents maintain state across interactions:

| State | Purpose | Storage |
|-------|---------|---------|
| **Session Context** | Current task data | `.tmp/sessions/{id}/context.md` |
| **Agent Memory** | Agent-specific data | Per-agent workspace |
| **Context Cache** | Loaded context files | `.tmp/context-cache/` |
| **External Docs** | Fetched documentation | `.tmp/external-context/{lib}/` |
| **R&D Knowledge** | Research findings | `.tmp/rnd/knowledge-base/` |

### How Decisions Are Made

```
DECISION TREE: Should I delegate or handle directly?

1. Is this a simple change?
   - YES → Handle directly with CoderAgent
   - NO → Continue to 2

2. Does it require multiple skill sets?
   - YES → TaskManager break down → Multiple agents
   - NO → Continue to 3

3. Is context required from external sources?
   - YES → ExternalScout fetch first
   - NO → Continue to 4

4. Is it a research/investigation task?
   - YES → Explore agent + R&D tracking
   - NO → Route to appropriate specialist

DECISION TREE: Which agent to use?

CoderAgent ← writing new code, refactoring
CodeReviewer ← reviewing existing code, security checks
TestEngineer ← writing tests, TDD
DocWriter ← creating/updating documentation
TaskManager ← breaking down complex features
BuildAgent ← validating builds, type checking
explore ← understanding codebase, finding patterns
ContextScout ← finding project standards (always exempt)
ExternalScout ← fetching external library docs
```

### Error Handling Internals

```
ERROR HANDLING FLOW:

1. ERROR DETECTED
   ↓
2. CATEGORIZE
   ├─ Syntax/Type → BuildAgent validation
   ├─ Logic → Report to user
   ├─ Context → Re-run ContextScout
   ├─ Delegation → Retry or escalate
   └─ External (API, etc.) → Fallback/Report
   ↓
3. DECIDE ACTION
   ├─ Can fix immediately → Report first
   ├─ Requires user input → Pause, ask
   └─ System error → Log, report
   ↓
4. EXECUTE OR ESCALATE
```

### Session Lifecycle Internals

```
SESSION CREATION:
1. User approves proposal
2. Generate session ID: {YYYY-MM-DD}-{slug}
3. Create directory: .tmp/sessions/{id}/
4. Create context.md with template
5. Initialize task tracking

SESSION ACTIVITY:
1. ContextScout loads standards
2. TaskManager creates subtasks (if complex)
3. Agents work from session context
4. Progress tracked in context.md
5. Validation runs per task

SESSION COMPLETION:
1. All exit criteria met
2. Report summary to user
3. Ask permission to cleanup
4. Delete session directory
5. Update agent-capabilities.json if needed
```

---

## Agent Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│                     OpenAgent (Primary)                      │
│                  Universal orchestrator                     │
└─────────────────────────────────────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  Subagents      │  │  Supervisors    │  │  Orchestration  │
│  ───────────    │  │  ──────────     │  │  ───────────    │
│  CoderAgent     │  │  meta-supervisor│  │  task-execution │
│  CodeReviewer   │  │  architecture-  │  │  context-loading│
│  TestEngineer   │  │    supervisor   │  │  delegation     │
│  DocWriter      │  │  memory-curator │  │  approval-gates │
│  TaskManager    │  │  project-mgr    │  │  safety         │
│  BuildAgent     │  │  rnd-supervisor │  │  routing-table │
│  explore        │  │  graph-query   │  │                 │
│  general        │  │                 │  │                 │
└─────────────────┘  └─────────────────┘  └─────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│              Context & Discovery Layer                       │
│  ContextScout  │  ExternalScout  │  ContextOrganizer        │
└─────────────────────────────────────────────────────────────┘
```

## Direct Subagents

| Agent | Purpose | When to Use |
|-------|---------|-------------|
| **CoderAgent** | Execute coding subtasks in sequence | Writing code, implementing features |
| **CodeReviewer** | Code review, security, quality assurance | Reviewing code, checking security |
| **TestEngineer** | Test authoring and TDD | Writing tests, test-driven development |
| **DocWriter** | Documentation authoring | Creating/updating documentation |
| **TaskManager** | Task breakdown into atomic subtasks with dependency tracking | Breaking down complex features |
| **BuildAgent** | Type check and build validation | Validating builds, type checking |
| **explore** | Fast codebase exploration (quick/medium/very thorough) | Understanding codebase structure |
| **general** | General-purpose research and multi-step tasks | Research, complex investigations |

## Context & Discovery Layer

| Agent | Purpose | Notes |
|-------|---------|-------|
| **ContextScout** | Discovers context files from `.opencode/context/` | **Exempt from approval gate** |
| **ExternalScout** | Fetches live documentation for external libraries via Context7 | Reads from `.tmp/external-context/` |
| **ContextOrganizer** | Generates and organizes context files | Internal orchestration |

## Supervisors

| Supervisor | Purpose |
|------------|---------|
| **meta-supervisor** | Overall orchestration oversight |
| **architecture-supervisor** | Pattern governance, drift detection |
| **memory-curator** | Context memory hygiene, deduplication, maintains agent-capabilities.json |
| **project-manager-supervisor** | Feature auditing, route analysis |
| **rnd-supervisor** | Research & development tracking |
| **graph-query-engine** | Graph-based query handling |

## Execution Priority Tiers

| Tier | Level | Description | Override Rule |
|------|-------|-------------|---------------|
| **Tier 1** | Safety & Approval Gates | Permissions, context loading mandate | **Always executes first** |
| **Tier 2** | Core Workflow | Analyze → Approve → Execute → Validate → Summarize | — |
| **Tier 3** | Optimization | Minimal session overhead | — |

**Rule**: Tier 1 always overrides Tier 2/3. If speed conflicts with quality → be concise.

## Two Execution Paths

### Path 1: Conversational (Pure Questions)

```
Trigger: User asks question without requesting action
Approval: No approval needed
Example: "How does X work?" → Answer naturally
```

### Path 2: Task Execution

```
Trigger: User requests action (bash, write, edit, task)
Approval: Requires approval gate
Flow: Load task-execution.md + context-loading.md
Example: "Fix the bug in X" → Propose → Get approval → Execute
```

---

# 3. Context System

## How Context Loading Works

```
Stage 1: DISCOVER   → ContextScout finds paths (read-only)
Stage 2: PROPOSE    → Show user lightweight summary
Stage 3: APPROVE    → User says yes
Stage 4: INIT       → Create session dir + context.md
Stage 5: DELEGATE   → Pass context to specialist agents
Stage 6: CLEANUP    → Ask user, then delete session
```

## Context Index Structure

**Location**: `.opencode/context/navigation.md`

```
.opencode/context/
├── core/                   # Universal standards & workflows
├── openagents-repo/        # Repository-specific work
├── development/            # Software development (all stacks)
├── ui/                     # Visual design & UX
├── content-creation/       # Content creation (all formats)
├── data/                   # Data engineering & analytics
├── product/                # Product management
└── learning/              # Educational content
```

## Quick Routes

| Task | Context Path |
|------|-------------|
| **Write code** | `core/standards/code-quality.md` |
| **Write tests** | `core/standards/test-coverage.md` |
| **Write docs** | `core/standards/documentation.md` |
| **Review code** | `core/workflows/code-review.md` |
| **Delegate task** | `core/workflows/task-delegation-basics.md` |

## When Context Is Auto-Loaded

| Trigger | Context Loaded |
|---------|---------------|
| Task execution (write/edit/bash) | Always loads mandatory context |
| Documentation writing | Loads documentation.md standards |
| Code review | Loads code-review.md standards |
| Task delegation | Loads task-delegation-basics.md |

## Manual Context Discovery

**Always call ContextScout before writing documentation or making significant changes:**

```javascript
task(subagent_type="ContextScout", description="Find project standards", prompt="Find documentation formatting standards, structure conventions, tone guidelines, and example requirements for this project.")
```

## Session Context Pattern

**When to create sessions**:
- User has **approved** the proposed approach
- Task requires delegation to TaskManager or working agents
- Task is complex enough to need shared context (4+ files, >60min)

**Location**: `.tmp/sessions/{YYYY-MM-DD}-{task-slug}/context.md`

**Template structure**:
```markdown
# Task Context: {Task Name}

Session ID: {YYYY-MM-DD}-{task-slug}
Created: {ISO timestamp}
Status: in_progress

## Current Request
{What user asked for — verbatim or close paraphrase}

## Context Files (Standards to Follow)
Paths ContextScout discovered. Downstream agents load these.
- .opencode/context/core/standards/code-quality.md
- {other paths}

## Reference Files (Source Material)
Project files relevant to the task — NOT standards.
- {e.g. package.json}
- {e.g. src/existing-module.ts}

## External Context Fetched
Live docs fetched via ExternalScout. Read-only cache.
- `.tmp/external-context/{package}/{topic}.md`

## Components
- {Component 1} — {what it does}

## Constraints
{Technical constraints, preferences, version requirements}

## Exit Criteria
- [ ] {specific completion condition}

## Progress
- [ ] Session initialized
- [ ] Tasks created (if using TaskManager)
- [ ] Implementation complete
```

---

# 4. Skills System

Skills provide specialized instructions and workflows for specific tasks. Use the `skill` tool when a task matches a skill's description.

## Available Skills

| Skill | Purpose | When to Use |
|-------|---------|-------------|
| **context7** | Retrieve up-to-date documentation for libraries/frameworks | Looking up library docs, verifying API usage |
| **find-skills** | Discover and install agent skills | Finding functionality that might exist as a skill |
| **shadcn** | Manage shadcn components and projects | Working with shadcn/ui, component registries |
| **shadcn-component-discovery** | Discover components across ecosystem | Exploring UI components before building custom |
| **task-management** | CLI for tracking feature subtasks | Tracking feature development progress |

## How to Invoke Skills

### context7 Skill

```javascript
skill(name="context7")
// Then use the skill to fetch library docs
```

**Use when**:
- Need current documentation for a library/framework
- Verifying API usage for external packages
- Finding code examples for specific APIs

### find-skills Skill

```javascript
skill(name="find-skills")
// Discover available skills for a task
```

**Use when**:
- "How do I do X?"
- "Find a skill for X"
- "Is there something for...?"

### shadcn Skill

```javascript
skill(name="shadcn")
// Load shadcn component management instructions
```

**Use when**:
- Running `shadcn init`
- Adding components: `npx shadcn@latest add button`
- Debugging shadcn components

### shadcn-component-discovery Skill

```javascript
skill(name="shadcn-component-discovery")
// Discover components across shadcn ecosystem
```

**Use when**:
- Need UI component for data table, form, modal, etc.
- Exploring Magic UI, Aceternity, ReUI, etc.
- Finding shadcn-compatible registries

### task-management Skill

```javascript
skill(name="task-management")
// Load task CLI instructions
```

**Use when**:
- Managing complex features with subtasks
- Tracking progress on multi-step implementations
- Managing task dependencies

## Skill Loading Workflow

```
1. Recognize task matches skill description
2. Load skill: skill(name="skill-name")
3. Follow skill instructions for the task
4. Execute within skill framework
```

---

# 5. Execution Workflows

## Task Execution Flow

```
1. ANALYZE   → Understand the request, identify what needs to be done
2. PROPOSE   → Show user lightweight summary of approach (read-only)
3. APPROVE   → Wait for user confirmation
4. EXECUTE   → Perform the action (only after approval)
5. VALIDATE  → Check the result works correctly
6. SUMMARIZE → Report back to user with results
7. CLEANUP   → Ask user before deleting session files
```

## Approval Gates

Task execution requires approval. The system:

1. **Analyzes** the request
2. **Proposes** an approach (read-only, nothing written)
3. **Waits** for user approval
4. **Executes** only after approval

**Report-First Principle**:
```javascript
// ❌ DON'T: Auto-fix without asking
// ✅ DO: Report issue, propose solution, wait for approval
```

## Context Loading for Tasks

When task is triggered (bash/write/edit/task):

```
1. Load task-execution.md
2. Load context-loading.md
3. Check permissions
4. Discover relevant context files
5. Present proposal to user
6. Wait for approval
7. Execute with context loaded
```

## Validation Steps

After execution, validate:

| Check | Purpose |
|-------|---------|
| **Syntax** | Code parses correctly |
| **Types** | Type checking passes |
| **Tests** | New code doesn't break existing tests |
| **Build** | Project builds successfully |
| **Standards** | Follows project conventions |

---

# 6. Tutorials

## Tutorial 1: Basic Code Task

**Scenario**: Creating a new function in your project

### Step-by-Step Guide

**Step 1: Analyze the request**
```
User: "Create a utility function to calculate discount tiers"
→ Identify: This is a task (write), needs approval
→ Type: Code writing task
```

**Step 2: Discover context**
```javascript
task(subagent_type="ContextScout", description="Find code quality standards", prompt="Find code quality standards, naming conventions, and patterns for this project")
```

**Step 3: Propose approach**
```
Proposed approach:
- Location: src/utils/pricing.ts (or similar)
- Function: calculateTierDiscount(amount, tier)
- Returns: discount percentage based on tier
- Include: TypeScript types, JSDoc comments, unit tests
```

**Step 4: Get approval**
```
"Shall I proceed with this implementation?"
[ ] Yes
[ ] No
```

**Step 5: Execute**
```javascript
write(content="""...function implementation...", filePath="src/utils/pricing.ts")
```

**Step 6: Validate**
```
- Run type check: npx tsc --noEmit
- Run tests: npm test
- Review against standards
```

**Step 7: Report**
```
✅ Created src/utils/pricing.ts with:
- calculateTierDiscount(amount, tier) function
- TypeScript types for parameters
- JSDoc comments with examples
- Unit tests covering all tiers
```

### What Happens Under the Hood

```
1. OpenAgent receives request
2. Identifies as task (bash/write/edit/task trigger)
3. Loads task-execution.md, context-loading.md
4. ContextScout discovers code-quality.md standards
5. Proposal presented to user
6. User approves
7. CoderAgent executes with loaded context
8. BuildAgent validates types
9. Results reported to user
```

---

## Tutorial 2: Multi-Agent Collaboration

**Scenario**: Implementing a feature requiring code + tests + documentation

### Step-by-Step Guide

**Step 1: Initial analysis**
```
User: "Add user authentication with OAuth"
→ Complex task requiring multiple specialist agents
→ Need to delegate to CoderAgent, TestEngineer, DocWriter
```

**Step 2: Discover context**
```javascript
task(subagent_type="ContextScout", description="Find all relevant standards", prompt="Find code quality, testing, documentation standards for this project. Also find any existing auth patterns.")
```

**Step 3: Propose and get approval**
```
Proposed:
1. Create session: .tmp/sessions/auth-oauth/
2. TaskManager breaks down into subtasks
3. CoderAgent implements core auth logic
4. TestEngineer writes tests
5. DocWriter documents the API
```

**Step 4: Initialize session**
```javascript
// After approval
write(content="""# Task Context: OAuth Authentication

Session ID: 2026-05-12-auth-oauth
Status: in_progress

## Context Files
- .opencode/context/core/standards/code-quality.md
- .opencode/context/core/standards/test-coverage.md
- .opencode/context/core/standards/documentation.md

## Reference Files
- src/auth/existing-patterns.ts
- package.json

## Exit Criteria
- [ ] OAuth implementation complete
- [ ] Tests passing
- [ ] Documentation updated
""", filePath=".tmp/sessions/auth-oauth/context.md")
```

**Step 5: Delegate to TaskManager**
```javascript
task(subagent_type="TaskManager", description="Break down OAuth feature", prompt="Load context from .tmp/sessions/auth-oauth/context.md\n\nBreak down OAuth authentication feature into atomic subtasks with dependencies.")
```

**Step 6: Coordinate agents**
```javascript
// CoderAgent: implements core logic
task(subagent_type="CoderAgent", description="Implement OAuth", prompt="Load context from .tmp/sessions/auth-oauth/context.md\n\nImplement OAuth authentication based on subtask JSONs.")

// TestEngineer: writes tests
task(subagent_type="TestEngineer", description="Write auth tests", prompt="Load context from .tmp/sessions/auth-oauth/context.md\n\nWrite tests for OAuth implementation.")

// DocWriter: documents API
task(subagent_type="DocWriter", description="Document auth API", prompt="Load context from .tmp/sessions/auth-oauth/context.md\n\nDocument the OAuth authentication API.")
```

**Step 7: Validate and report**
```
✅ OAuth Authentication Feature Complete
- Core implementation: src/auth/oauth.ts
- Tests: tests/auth/oauth.test.ts (95% coverage)
- Documentation: docs/auth/oauth.md
```

### Coordination Patterns

| Pattern | Use When |
|---------|----------|
| **Sequential** | Tasks depend on each other (implement → test → document) |
| **Parallel** | Tasks are independent (multiple files can be done simultaneously) |
| **Gate** | Next task requires previous to complete (tests gate documentation) |

---

## Tutorial 3: Context-First Development

**Scenario**: Working with an unfamiliar codebase

### Step-by-Step Guide

**Step 1: Explore the codebase**
```javascript
task(subagent_type="explore", description="Understand project structure", prompt="Explore this codebase quickly. Identify:\n1. Project type (framework, language)\n2. Directory structure\n3. Key configuration files\n4. Existing patterns for components, utils, services")
```

**Step 2: Discover project standards**
```javascript
task(subagent_type="ContextScout", description="Find development standards", prompt="Find all development standards, coding conventions, and project-specific patterns in .opencode/context/")
```

**Step 3: Read key context files**
```
Priority order:
1. core/standards/code-quality.md
2. core/standards/test-coverage.md
3. core/standards/documentation.md
4. project-specific guides (development/, openagents-repo/, etc.)
```

**Step 4: Build your context file**
```markdown
# My Task Context

## Project Type
TypeScript + React + Node.js

## Standards to Follow
- src/components/ - React components
- src/utils/ - Utility functions
- tests/ - Test files alongside source

## Naming Conventions
- Components: PascalCase (UserProfile.tsx)
- Utils: camelCase (formatDate.ts)
- Tests: *.test.ts

## Patterns Found
- Use composable components
- Utils are pure functions
- Error handling via Result type
```

**Step 5: Execute with context**
```
Now you have project context → proceed with confidence
```

### Using ContextScout Effectively

```javascript
// Basic discovery
task(subagent_type="ContextScout", description="Find docs standards", prompt="Find documentation formatting standards")

// Deep discovery for complex tasks
task(subagent_type="ContextScout", description="Find all relevant context", prompt="Find code quality, testing, security, and API design standards relevant to building a REST API")
```

---

## Tutorial 4: Code Review Workflow

**Scenario**: Reviewing a PR or set of changes

### Step-by-Step Guide

**Step 1: Load code review standards**
```
Read: .opencode/context/core/workflows/code-review.md
```

**Step 2: Identify what to review**
```
PR includes:
- src/services/user.ts (new user service)
- src/routes/auth.ts (auth endpoints)
- tests/user.test.ts (unit tests)
```

**Step 3: Use CodeReviewer agent**
```javascript
task(subagent_type="CodeReviewer", description="Review user service PR", prompt="Review the following changes for a PR:\n\nFiles:\n- src/services/user.ts\n- src/routes/auth.ts\n- tests/user.test.ts\n\nCheck:\n1. Functionality - Does it do what it's supposed to?\n2. Security - Any vulnerabilities?\n3. Code quality - Clear naming, no duplication?\n4. Testing - Adequate coverage?\n5. Performance - Any obvious issues?\n\nReport format:\n## Summary: [brief overview]\n## Assessment: [Approve/Needs Work/Requires Changes]\n\n### Issues Found\n🔴 Critical:\n🟡 Warnings:\n🔵 Suggestions:\n\n### Positive Observations\n### Recommendations")
```

**Step 4: Review report output**
```markdown
## Code Review: User Service + Auth Routes

**Summary:** New user service with OAuth endpoints  
**Assessment:** Needs Work

---

### Issues Found

#### 🔴 Critical (Must Fix)
- **File:** src/routes/auth.ts:42
  **Issue:** OAuth state not validated, vulnerable to CSRF
  **Fix:** Validate state parameter on callback

#### 🟡 Warnings (Should Fix)
- **File:** src/services/user.ts:15
  **Issue:** No input validation on email field
  **Fix:** Add email format validation

#### 🔵 Suggestions (Nice to Have)
- **File:** tests/user.test.ts:28
  **Issue:** Could use more edge case tests
  **Fix:** Add tests for empty email, invalid format

---

### Positive Observations
- ✅ Good test coverage (85%)
- ✅ Clear function names
- ✅ Proper error handling with Result type

### Recommendations
1. Fix CSRF vulnerability before merge
2. Add email validation
3. Consider adding integration tests
```

**Step 5: Get user approval for fixes**
```
CodeReviewer found 1 critical, 2 warnings, 1 suggestion.
Shall I fix the critical issue (CSRF vulnerability)?
```

### Security Considerations

| Check | What to Look For |
|-------|-----------------|
| **Input validation** | Sanitize all user input |
| **SQL injection** | Use parameterized queries |
| **XSS** | Escape output, CSP headers |
| **Authentication** | Proper auth flow, token handling |
| **Secrets** | No hardcoded credentials, API keys |

---

## Tutorial 5: Testing with TDD

**Scenario**: Test-driven development for a new feature

### Step-by-Step Guide

**Step 1: Load TDD standards**
```
Read: .opencode/context/core/standards/test-coverage.md
```

**Step 2: Write failing test first**
```javascript
// Write the test BEFORE implementation
write(content="""import { describe, it, expect } from 'vitest';
import { calculateDiscount } from '../src/utils/pricing';

describe('calculateDiscount', () => {
  it('should return 0% for orders under $100', () => {
    expect(calculateDiscount(50)).toBe(0);
  });

  it('should return 10% for orders $100-$500', () => {
    expect(calculateDiscount(200)).toBe(10);
  });

  it('should return 20% for orders over $500', () => {
    expect(calculateDiscount(1000)).toBe(20);
  });
});
""", filePath="src/utils/pricing.test.ts")
```

**Step 3: Verify test fails**
```bash
npm test -- pricing.test.ts
# Expected: Test fails (function doesn't exist yet)
```

**Step 4: Implement to pass test**
```javascript
write(content="""/**
 * Calculate discount percentage based on order amount
 * 
 * @param amount - Order total in dollars
 * @returns Discount percentage (0, 10, or 20)
 * 
 * @example
 * calculateDiscount(50)  // 0
 * calculateDiscount(200)  // 10
 * calculateDiscount(1000) // 20
 */
export function calculateDiscount(amount: number): number {
  if (amount < 100) return 0;
  if (amount <= 500) return 10;
  return 20;
}
""", filePath="src/utils/pricing.ts")
```

**Step 5: Verify test passes**
```bash
npm test -- pricing.test.ts
# Expected: All tests pass
```

**Step 6: Use TestEngineer for comprehensive coverage**
```javascript
task(subagent_type="TestEngineer", description="Add edge case tests", prompt="Add edge case tests for calculateDiscount:\n- Edge: exactly $100 (boundary)\n- Edge: exactly $500 (boundary)\n- Invalid: negative amounts\n- Invalid: non-numeric input")
```

### Integration with Build Validation

```
TDD Flow with Build:
1. Write failing test → RED
2. Write minimal implementation → RED
3. Verify test passes → GREEN
4. Run build validation: npx tsc --noEmit → GREEN
5. Check test coverage: 100% → GREEN
6. Refactor if needed
7. Commit
```

---

## Tutorial 6: Component Discovery

**Scenario**: Need UI component for data table with sorting

### Step-by-Step Guide

**Step 1: Load component discovery skill**
```javascript
skill(name="shadcn-component-discovery")
```

**Step 2: Discover available components**
```javascript
task(subagent_type="ContextScout", description="Find table components", prompt="Search for data table components with sorting in shadcn-compatible registries:\n- Look for: table, data-table, sortable\n- Check: Magic UI, Aceternity, ReUI, Tailark\n- Find components that have sorting built-in")
```

**Step 3: Evaluate options**
```
Found options:
1. shadcn/ui table - Basic table component
2. TanStack Table - Full-featured with sorting
3. Magic UI data table - Pre-styled with sorting

Recommendation: TanStack Table with shadcn/ui for best control
```

**Step 4: Add the component**
```bash
# Install TanStack Table
npm install @tanstack/react-table

# Add shadcn table
npx shadcn@latest add table

# Add sorting capabilities
# (document the pattern)
```

**Step 5: Implementation**
```typescript
// Using TanStack Table + shadcn/ui
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { ArrowUpDown } from 'lucide-react';

const columns: ColumnDef<User>[] = [
  {
    accessorKey: 'name',
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        Name
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
  },
];
```

### Selecting the Right Component

| Need | Recommended |
|------|-------------|
| Basic data display | shadcn/ui table |
| Complex filtering/sorting | TanStack Table |
| Server-side pagination | TanStack Table + API |
| Pre-styled with animations | Magic UI |
| Simple sortable | Tailark table |

---

## Tutorial 7: Documentation Generation

**Scenario**: Documenting a new API module

### Step-by-Step Guide

**Step 1: Load documentation standards**
```javascript
task(subagent_type="ContextScout", description="Find documentation standards", prompt="Find documentation formatting standards, structure conventions, tone guidelines, and example requirements for this project.")
```

**Step 2: Analyze the module**
```
Module: src/api/users.ts
Contains:
- createUser(email, name) → User
- getUser(id) → User | null
- updateUser(id, data) → User
- deleteUser(id) → boolean
```

**Step 3: Use DocWriter agent**
```javascript
task(subagent_type="DocWriter", description="Document users API", prompt="Create API documentation for src/api/users.ts module.\n\nRequirements:\n- Follow project documentation standards\n- Include usage examples\n- Document all 4 endpoints\n- Show request/response formats\n- Include error handling\n\nOutput to: docs/api/users.md")
```

**Step 4: Review generated docs**
```markdown
# Users API

## createUser(email, name)
Creates a new user.

**Parameters:**
- `email: string` - User's email address
- `name: string` - User's display name

**Returns:** `User` object

**Example:**
```typescript
const user = await createUser('john@example.com', 'John Doe');
// { id: '123', email: 'john@example.com', name: 'John Doe' }
```

**Errors:**
- 400 - Invalid email format
- 409 - Email already exists
```

### Best Practices

| Practice | Why |
|----------|-----|
| Show working code examples | Readers can copy/paste |
| Document error cases | Helps with debugging |
| Include expected output | Validates understanding |
| Explain WHY, not just WHAT | Helps future maintainers |

---

## Tutorial 8: Task Management

**Scenario**: Complex multi-step feature with dependencies

### Step-by-Step Guide

**Step 1: Load task management skill**
```javascript
skill(name="task-management")
```

**Step 2: Use TaskManager to break down**
```javascript
task(subagent_type="TaskManager", description="Break down feature", prompt="Break down this feature into atomic subtasks:\n\nFeature: User dashboard with analytics\n\nRequirements:\n- Dashboard page with charts\n- Data aggregation service\n- API endpoints for analytics\n- Real-time updates via WebSocket\n\nConsider:\n- Frontend components needed\n- Backend services needed\n- API design\n- Testing requirements\n\nCreate subtasks with clear dependencies.")
```

**Step 3: Review generated task structure**
```json
{
  "name": "user-dashboard-analytics",
  "status": "in_progress",
  "subtasks": [
    {
      "id": "01",
      "title": "Design API schema",
      "status": "completed",
      "depends_on": []
    },
    {
      "id": "02",
      "title": "Implement analytics service",
      "status": "in_progress",
      "depends_on": ["01"]
    },
    {
      "id": "03",
      "title": "Create dashboard components",
      "status": "pending",
      "depends_on": ["01"]
    },
    {
      "id": "04",
      "title": "Add WebSocket support",
      "status": "pending",
      "depends_on": ["02"]
    },
    {
      "id": "05",
      "title": "Write integration tests",
      "status": "pending",
      "depends_on": ["02", "03"]
    }
  ]
}
```

**Step 4: Execute tasks in dependency order**
```bash
# Get next eligible tasks
task-cli.ts next user-dashboard-analytics

# Output: Task 02 (depends on 01 which is done)
# Output: Task 03 (depends on 01 which is done)
# (02 and 03 can run in parallel)
```

**Step 5: Track progress**
```bash
# Check status
task-cli.ts status user-dashboard-analytics

# Output:
# Progress: 2/5 tasks (40%)
# 01: ✅ completed
# 02: 🔄 in_progress (agent: coder-agent)
# 03: ⏳ pending (waiting on 01)
# 04: ⏳ pending
# 05: ⏳ pending
```

**Step 6: Mark completion**
```bash
# After completing task 02
task-cli.ts complete user-dashboard-analytics 02 "Analytics service implemented with aggregation functions"

# TaskManager validates:
# - File created: src/services/analytics.ts
# - Tests passing
# - Documentation updated
```

### Dependency Management

| Pattern | Use Case |
|---------|----------|
| **Linear** | A → B → C (each depends on previous) |
| **Parallel** | A, B, C (independent, can run simultaneously) |
| **Fan-out** | A → B, A → C (one task unlocks multiple) |
| **Fan-in** | B → D, C → D (multiple must complete before D) |

---

## Tutorial 9: External Library Integration

**Scenario**: Using a new library (Drizzle ORM) with current documentation

### Step-by-Step Guide

**Step 1: Load context7 skill**
```javascript
skill(name="context7")
```

**Step 2: Fetch library documentation**
```javascript
task(subagent_type="ExternalScout", description="Fetch Drizzle docs", prompt="Fetch current documentation for Drizzle ORM:\n- Installation and setup\n- Schema definition\n- Query building\n- Migrations\n\nSave to: .tmp/external-context/drizzle/overview.md")
```

**Step 3: Discover project patterns**
```javascript
task(subagent_type="ContextScout", description="Find database patterns", prompt="Find any existing database, ORM, or data access patterns in this project")
```

**Step 4: Propose integration approach**
```
Found: Drizzle ORM docs
Project has: existing TypeScript patterns, Prisma schema for reference

Proposed approach:
1. Install drizzle-orm + drizzle-kit
2. Define schemas in src/db/schema.ts
3. Create query helpers in src/db/queries/
4. Add migration scripts
5. Write tests for queries
```

**Step 5: Get approval and implement**
```
"Shall I proceed with Drizzle integration?"
[ ] Yes, implement full integration
[ ] Start with schema only
[ ] Not now
```

### Using ExternalScout Effectively

```javascript
// Fetch specific topic
task(subagent_type="ExternalScout", description="Fetch Drizzle schema docs", prompt="Get Drizzle ORM schema definition patterns and best practices")

// Fetch multiple topics
task(subagent_type="ExternalScout", description="Fetch Drizzle core docs", prompt="Get Drizzle ORM core documentation:\n- Schema definition (3 examples)\n- Query building (common patterns)\n- Relationships (one-to-many, many-to-many)")
```

---

## Tutorial 10: Project Audit

**Scenario**: Analyzing project structure and quality

### Step-by-Step Guide

**Step 1: Use project-manager-supervisor**
```javascript
task(subagent_type="meta-supervisor", description="Run project audit", prompt="Run a comprehensive project audit:\n\nCheck:\n1. Project structure (directories, key files)\n2. Dependencies (package.json, outdated packages)\n3. Code quality (linting, formatting)\n4. Test coverage\n5. Documentation completeness\n6. Build health\n\nOutput a summary report with recommendations.")
```

**Step 2: Quick audit (lightweight)**
```bash
# Use built-in audit commands
/audit              # Quick overview
/audit --verbose    # Detailed report
```

**Step 3: Deep audit (detailed)**
```bash
/audit --deep       # Full analysis with:
// - File-by-file review
// - Dependency graph
// - Security vulnerabilities
// - Performance considerations
```

**Step 4: Review audit report**
```markdown
# Project Audit Report

## Summary
- Health Score: 85/100
- Files: 147
- Tests: 89 passing (82% coverage)
- Dependencies: 23 (2 outdated)

## Issues Found

### 🔴 Critical
- Missing input validation in src/api/users.ts
- Outdated dependency: lodash@4.17.15 (security)

### 🟡 Warnings
- Test coverage below 90% in src/utils/
- Missing JSDoc on 12 functions

### 🔵 Suggestions
- Consider migrating to ESM
- Add Prettier for formatting

## Recommendations
1. Update lodash immediately
2. Add input validation layer
3. Increase test coverage to 90%
```

### Running Targeted Audits

| Command | Scope |
|---------|-------|
| `/audit` | Quick overview |
| `/audit --verbose` | Detailed report |
| `/audit --deep` | Full analysis |
| `/audit --security` | Security only |
| `/audit --quality` | Code quality only |
| `/audit --deps` | Dependencies only |

---

# 7. Best Practices

## When to Use Which Agent

| Task | Agent | Why |
|------|-------|-----|
| Write new function | CoderAgent | Sequential implementation with standards |
| Review PR | CodeReviewer | Structured review with checklist |
| Write tests | TestEngineer | TDD approach, coverage focus |
| Create docs | DocWriter | Standards-based documentation |
| Break down feature | TaskManager | Atomic tasks, dependency tracking |
| Type check | BuildAgent | Build validation |
| Find project standards | ContextScout | Context discovery |
| Find library docs | ExternalScout | Live documentation |
| Explore codebase | explore | Fast, configurable depth |

## Delegation Patterns

### Pattern 1: Simple Task (No Session)
```
User: "Add type to this function"
→ Analyze → Propose → Approve → Execute → Report
→ No session needed (direct execution)
```

### Pattern 2: Medium Task (Direct Delegation)
```
User: "Refactor the auth module"
→ Discover context → Propose → Approve
→ Delegate to CoderAgent with context
→ Validate → Report
→ No session file (agent completes task)
```

### Pattern 3: Complex Task (With Session)
```
User: "Build user dashboard with analytics"
→ Discover context → Propose → Approve
→ Create session: .tmp/sessions/{task}/
→ TaskManager breaks into subtasks
→ Multiple agents work from session
→ Cleanup session when done
```

## Context Optimization

| Principle | Practice |
|-----------|----------|
| **Load only what's needed** | Don't load entire context directories |
| **Pre-discover for delegation** | ContextScout before delegating |
| **Lazy load** | Load context files only when agent needs them |
| **MVI format** | Keep context files scannable (<30s) |
| **Reference, don't duplicate** | Link to full docs, don't rewrite |

## Safety Guidelines

### Always Do

| ✅ | Why |
|----|-----|
| Check permissions before action | Safety first |
| Load context before writing | Ensures consistency |
| Report before fix | User controls changes |
| Validate after execution | Catch errors early |
| Get approval before cleanup | User may want session preserved |

### Never Do

| ❌ | Why |
|----|-----|
| Skip ContextScout | Writing without standards = inconsistency |
| Auto-fix without approval | User may not want the fix |
| Skip approval gates | Safety mechanism |
| Modify non-markdown files (DocWriter) | Only documentation |
| Be verbose | If it can't be understood in <30s, it's too long |

## Report-First Workflow

```
1. Identify issue during task
2. STOP execution
3. Report the issue clearly:
   - What you found
   - Why it's a problem
   - What you propose to fix
4. Wait for approval
5. Execute fix only if approved

❌ DON'T: "I noticed X, fixing it now..."
✅ DO: "I found X. This is a problem because Y. 
         I propose to fix it by Z. 
         Shall I proceed?"
```

---

# 8. Troubleshooting

## Common Issues

### Issue: Context files not found

**Symptom**: "Context file not found" errors

**Solution**:
```javascript
// Run ContextScout to verify paths
task(subagent_type="ContextScout", description="Find context", prompt="Find the context files for [your task]")
// Then use exact paths returned
```

### Issue: Task approval not working

**Symptom**: Tasks execute without approval prompt

**Solution**:
- Verify trigger is task-related (bash/write/edit/task)
- Questions (pure_question_no_exec) don't need approval
- Check if approval-gates agent is functioning

### Issue: Agent not responding

**Symptom**: Delegation hangs or times out

**Solution**:
```javascript
// Check agent status
task(subagent_type="ContextScout", description="Verify agents", prompt="List available agents and their capabilities")

// Try simpler delegation
task(subagent_type="general", description="Simple task", prompt="Do [simple task]")
```

### Issue: Session context lost

**Symptom**: Downstream agents don't have context

**Solution**:
```
1. Verify session file exists: .tmp/sessions/{id}/context.md
2. Check paths in context.md are valid
3. Re-read context.md to downstream agent
4. If corrupted, re-create session from proposal
```

### Issue: Validation failing

**Symptom**: Tests/build fail after implementation

**Solution**:
```bash
# Run specific validation
npx tsc --noEmit           # Type check
npm test -- --run          # Run tests
npm run build              # Build project

# Check output for specific errors
# Fix errors based on validation output
```

## Recovery Patterns

### Pattern 1: Rollback and Retry

```
Implementation breaks tests:
1. Save current state (git stash)
2. Run original tests (should pass)
3. Re-implement with more care
4. Run tests (should pass now)
5. Restore if needed
```

### Pattern 2: Incremental Fix

```
Large issue found:
1. Identify smallest fixable part
2. Fix that part
3. Validate
4. Repeat until complete
```

### Pattern 3: Session Recovery

```
Session corrupted:
1. Check what was done: progress check
2. Identify last valid state
3. Recreate session from last good point
4. Continue from there
```

## Debug Techniques

| Technique | When to Use |
|-----------|-------------|
| **Read context files** | Verify what was loaded |
| **Check session files** | Verify delegation context |
| **Run validation manually** | Identify specific failures |
| **Use explore agent** | Understand codebase structure |
| **Add logging** | Track execution flow |
| **Simplify task** | Isolate the issue |

---

# 9. Configuration Reference

## Configuration Files

| File | Purpose |
|------|---------|
| `.opencode/config/agent-metadata.json` | Agent ID, name, category, type, version, tags, dependencies |
| `.opencode/context/navigation.md` | Main context index |
| `.opencode/context/AGENT_SYSTEM.md` | Agent system reference |

## Agent Metadata Schema

```json
{
  "id": "agent-name",
  "name": "Agent Name",
  "category": "development|content|data|product|learning",
  "type": "primary|subagent|supervisor",
  "version": "1.0.0",
  "author": "agent-author",
  "tags": ["code", "review", "testing"],
  "dependencies": ["context7", "shadcn"]
}
```

## Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `OPENCODE_CONTEXT_PATH` | Custom context directory | `.opencode/context/` |
| `OPENCODE_SESSION_PATH` | Session storage location | `.tmp/sessions/` |
| `OPENCODE_TASK_PATH` | Task files location | `.tmp/tasks/` |

## Customization Options

### Adding Custom Context Files

```
1. Create file in appropriate category
2. Add to navigation.md
3. Follow naming conventions: descriptive-name.md
4. Include frontmatter: context, priority, version, updated
```

### Creating Custom Agents

```
1. Define in .opencode/config/agent-metadata.json
2. Create agent definition in .opencode/agent/{category}/
3. Add to agent hierarchy
4. Document in context files
```

### Custom Skills

```
1. Create skill file in .opencode/skills/{skill-name}/
2. Include SKILL.md with instructions
3. Register in available_skills list
4. Document in this guide
```

---

## Quick Reference Cards

### Execution Path Decision

```
Is this a question?
├─ YES → Conversational path (no approval)
└─ NO → Is this an action?
        ├─ YES → Task path (approval required)
        └─ NO → Conversational path
```

### Agent Selection Guide

```
Need to write code?          → CoderAgent
Need to review code?         → CodeReviewer
Need to write tests?         → TestEngineer
Need to write docs?          → DocWriter
Need to break down work?     → TaskManager
Need to validate build?      → BuildAgent
Need to find project standards? → ContextScout
Need to find library docs?   → ExternalScout (context7 skill)
Need to explore codebase?    → explore
Need general help?          → general
```

### Priority Rule Summary

```
Tier 1 (Safety)    → ALWAYS first
Tier 2 (Workflow)  → After safety checks
Tier 3 (Optimize)  → After workflow complete
```

### Report-First Template

```
ISSUE FOUND: [Description]

Why it's a problem: [Impact]

Proposed fix: [Solution]

Shall I proceed with this fix?
[ ] Yes
[ ] No
[ ] Show me the fix first
```

---

## Related Documentation

| Document | Purpose |
|----------|---------|
| `AGENT_SYSTEM.md` | Complete agent system reference |
| `navigation.md` | Main context index |
| `core/standards/code-quality.md` | Code quality standards |
| `core/standards/test-coverage.md` | Test coverage standards |
| `core/standards/documentation.md` | Documentation standards |
| `core/workflows/task-delegation-basics.md` | Task delegation guide |
| `core/workflows/code-review.md` | Code review guidelines |
| `core/task-management/guides/managing-tasks.md` | Task management guide |

---

**Last Updated**: 2026-05-12  
**Version**: 1.0  
**Context**: system/opencode-system-guide