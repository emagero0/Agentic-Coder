<!-- Context: system/agent-system | Priority: critical | Version: 1.0 | Updated: 2026-05-12 -->

# OpenCode Agent System Documentation

**Purpose**: Comprehensive reference for understanding the OpenCode agent architecture, hierarchy, and interaction patterns.

---

## Quick Reference

| Item | Value |
|------|-------|
| **Model** | minimax-m2.5-free |
| **Platform** | win32 (PowerShell) |
| **Primary Agent** | OpenAgent |
| **Context Index** | `.opencode/context/navigation.md` |
| **Execution Priority** | Safety → Workflow → Optimization |

---

## 1. System Overview

OpenCode is a universal AI agent system designed for code, documentation, tests, and workflow coordination. It operates as a hierarchical agent architecture with specialized subagents for different tasks.

### Core Characteristics

- **Universal**: Handles code, docs, tests, and workflow coordination
- **Hierarchical**: Primary agent delegates to specialized subagents
- **Safe**: Safety-first approach with approval gates
- **Adaptive**: Conversational for questions, formal for tasks
- **Report-First**: Never auto-fix; always report and request approval

### Environment

- **Platform**: win32
- **Shell**: PowerShell
- **Model**: minimax-m2.5-free

---

## 2. Agent Hierarchy

### 2.1 Primary Agent

**OpenAgent** — The universal agent that serves as the entry point and orchestrates all work. It delegates tasks to specialized subagents based on the task type.

```
User Request → OpenAgent → [Specialized Subagent] → Result
```

### 2.2 Direct Subagents (via Task Tool)

The primary subagents available for delegation:

| Agent | Purpose | Use When |
|-------|---------|----------|
| **CoderAgent** | Execute coding subtasks in sequence | Writing code, implementing features |
| **CodeReviewer** | Code review, security, quality assurance | Reviewing code, checking security |
| **TestEngineer** | Test authoring and TDD | Writing tests, test-driven development |
| **DocWriter** | Documentation authoring | Creating/updating documentation |
| **TaskManager** | Task breakdown into atomic subtasks with dependency tracking | Breaking down complex features |
| **BuildAgent** | Type check and build validation | Validating builds, type checking |
| **explore** | Fast codebase exploration (quick/medium/very thorough) | Understanding codebase structure |
| **general** | General-purpose research and multi-step tasks | Research, complex investigations |

### 2.3 Context & Discovery Layer

These agents handle information retrieval and organization:

| Agent | Purpose |
|-------|---------|
| **ContextScout** | Discovers context files from `.opencode/context/` (exempt from approval gate) |
| **ExternalScout** | Fetches live documentation for external libraries via Context7 |
| **ContextOrganizer** | Generates and organizes context files |

### 2.4 Supervisors

Supervisors provide oversight and governance:

| Supervisor | Purpose |
|------------|---------|
| **meta-supervisor** | Overall orchestration oversight |
| **architecture-supervisor** | Pattern governance, drift detection |
| **memory-curator** | Context memory hygiene, deduplication, maintains agent-capabilities.json |
| **project-manager-supervisor** | Feature auditing, route analysis (auto lightweight + deep /audit commands) |
| **rnd-supervisor** | Research & development tracking |
| **graph-query-engine** | Graph-based query handling |

### 2.5 Internal Orchestration Agents

These handle internal workflow execution:

| Agent | Purpose |
|-------|---------|
| **task-execution** | Execute → validate → summarize workflow |
| **context-loading** | Mandatory context loading for safety |
| **delegation** | Routing tasks to appropriate agents |
| **batching** | Parallel task processing |
| **routing-table** | Agent routing decisions |
| **approval-gates** | Permission & safety checks |
| **permissions** | Permission enforcement |
| **safety** | Safety policy enforcement |

---

## 3. Execution Flows

### 3.1 Execution Paths

OpenCode supports two primary execution paths:

#### Path 1: Conversational (Pure Questions)

- **Trigger**: User asks a question without requesting action
- **Approval**: No approval needed
- **Example**: "How does X work?" or "What is Y?"

#### Path 2: Task Execution

- **Trigger**: User requests action (write code, create file, run command)
- **Approval**: Requires approval gate
- **Flow**: Loads `task-execution.md` + `context-loading.md`
- **Example**: "Fix the bug in X" or "Add feature Y"

### 3.2 Execution Priority Tiers

The system operates on three priority tiers:

| Tier | Level | Description |
|------|-------|-------------|
| **Tier 1** | Safety & Approval Gates | Permissions, context loading mandate — always executes first |
| **Tier 2** | Core Workflow | Analyze → Approve → Execute → Validate → Summarize |
| **Tier 3** | Optimization | Minimal session overhead |

**Priority Rule**: Tier 1 always overrides Tier 2/3. If writing speed conflicts with conciseness requirement → be concise.

### 3.3 Core Workflow

```
1. ANALYZE   → Understand the request
2. APPROVE  → Get user confirmation (for tasks)
3. EXECUTE  → Perform the action
4. VALIDATE → Check the result
5. SUMMARIZE → Report back to user
```

---

## 4. Available Skills

Skills provide specialized instructions and workflows for specific tasks:

| Skill | Purpose | When to Use |
|-------|---------|-------------|
| **context7** | Retrieve up-to-date documentation for software libraries, frameworks, and components via Context7 API | Looking up library docs, finding code examples, verifying API usage |
| **find-skills** | Discover and install agent skills | When you need functionality that might exist as an installable skill |
| **shadcn** | Manage shadcn components and projects — adding, searching, fixing, debugging, styling, composing UI | Working with shadcn/ui, component registries, presets |
| **shadcn-component-discovery** | Discover shadcn-compatible components and registries across the ecosystem | Exploring available UI components before building custom ones |
| **task-management** | CLI for tracking and managing feature subtasks with status, dependencies, and validation | Tracking feature development progress |

### Loading a Skill

Use the skill tool when a task matches a skill's description:

```
skill(name="context7")
skill(name="shadcn")
skill(name="find-skills")
```

---

## 5. Best Practices for Agent Interaction

### 5.1 Core Principles

| Principle | Description |
|-----------|-------------|
| **Lean** | Concise responses — if it can't be understood in <30 seconds, it's too long |
| **Adaptive** | Conversational for questions, formal for tasks |
| **Safe** | Safety first — always check permissions and safety |
| **Report First** | Never auto-fix — always report issues and request approval before making changes |

### 5.2 Context-First Approach

**Always call ContextScout before writing documentation or making significant changes.** This loads project standards and conventions.

```
task(subagent_type="ContextScout", description="Find documentation standards", prompt="Find documentation formatting standards, structure conventions, tone guidelines, and example requirements for this project.")
```

### 5.3 Task Delegation Best Practices

1. **Discover First**: Use ContextScout to find relevant context files
2. **Propose Second**: Show user a lightweight summary of the approach
3. **Wait for Approval**: Never write anything before user approval
4. **Delegate**: Pass session context to appropriate specialist agent
5. **Validate**: Check results before reporting to user
6. **Cleanup**: Ask user before deleting session files

### 5.4 What NOT to Do

- ❌ Don't skip ContextScout — writing without standards = inconsistent results
- ❌ Don't write without proposing first — always get confirmation
- ❌ Don't be verbose — concise + examples, not walls of text
- ❌ Don't skip examples — every concept needs a working code example
- ❌ Don't modify non-markdown files — documentation only (for DocWriter)
- ❌ Don't ignore existing style — match what's already there

---

## 6. Configuration and Setup

### 6.1 Context Index

The main entry point for finding context files:

**Location**: `.opencode/context/navigation.md`

Quick map for common tasks:

| Task | Context Path |
|------|---------------|
| Code quality | `code-quality` |
| Documentation | `documentation` |
| Test coverage | `test-coverage` |
| Code review | `code-review` |
| Task delegation | `task-delegation` |

### 6.2 Agent Metadata

Agent configuration is stored in:

```
.opencode/config/agent-metadata.json
```

This file contains:
- Agent ID, name, category, type, version
- Author, tags, dependencies

### 6.3 Memory and Context

The **memory-curator** supervisor maintains:
- Context memory hygiene
- Deduplication
- Agent capabilities registry (`agent-capabilities.json`)

---

## 7. Approval and Safety System

### 7.1 Approval Gates

Task execution requires approval. The system:

1. **Analyzes** the request
2. **Proposes** an approach (read-only, nothing written)
3. **Waits** for user approval
4. **Executes** only after approval

### 7.2 Safety First

Safety is always the top priority:

- **Permissions**: Checked before any action
- **Context Loading**: Mandatory for safety
- **Safety Policy**: Enforced by the safety agent

### 7.3 Report-First Principle

Never auto-fix without approval:
- Report the issue clearly
- Propose a solution
- Wait for user approval
- Then execute the fix

---

## 8. Related Documentation

| Document | Purpose |
|----------|---------|
| `navigation.md` | Main context index — find any context file |
| `core/workflows/task-delegation-basics.md` | How to delegate tasks properly |
| `core/workflows/code-review.md` | Code review workflow |
| `core/standards/code-quality.md` | Code quality standards |
| `core/standards/test-coverage.md` | Test coverage requirements |
| `core/standards/documentation.md` | Documentation standards |

---

## 9. Quick Start Checklist

New to OpenCode? Start here:

- [ ] Read this document (AGENT_SYSTEM.md)
- [ ] Check `navigation.md` for context files
- [ ] Understand the agent hierarchy (Section 2)
- [ ] Know the execution paths (Section 3)
- [ ] Remember the core principles (Section 5)
- [ ] Know when to use which skill (Section 4)

---

**Last Updated**: 2026-05-12
**Version**: 1.0
**Context**: system/agent-system