<!-- Context: project-intelligence/business | Priority: high | Version: 1.0 | Updated: 2026-05-12 -->

# Business Domain

> Document the business context, problems solved, and value created for the OpenCode OAC platform.

## Quick Reference

- **Purpose**: Understand why this project exists
- **Update When**: Business direction changes, new features shipped, pivot
- **Audience**: Developers needing context, stakeholders, product team

## Project Identity

```
Project Name: OpenCode OAC (Open Agent Coordinator)
Tagline: Cognitive event system and agent orchestration for OpenCode
Problem Statement: OpenCode agents need structured context, state management, event processing, and task coordination to be effective. Without OAC, each agent re-implements these capabilities ad-hoc, leading to inconsistent behavior, data loss, and poor reasoning quality.
Solution: OAC provides a cohesive platform layer — context management, state management, event processing, graph reasoning, and agent routing — so OpenCode agents focus on their domain tasks instead of infrastructure.
```

## Target Users

| User Segment | Who They Are | What They Need | Pain Points |
|--------------|--------------|----------------|-------------|
| OpenCode Agent Developers | Developers building or extending agents within OpenCode | A reliable platform for event processing, state persistence, context loading, and agent routing | Re-implementing context loading, state management, and event handling for every new agent; inconsistent agent behavior; data loss from unmanaged state |
| OpenCode Platform Contributors | Contributors maintaining or improving the OpenCode ecosystem | Clear architecture, documented decisions, testable abstractions | Monolithic undocumented code; difficulty onboarding new contributors; unclear rationale for past decisions |
| Agent End Users (Developers) | Developers using OpenCode agents for coding, documentation, testing, etc. | Agents that understand their project context, remember state across sessions, and coordinate complex tasks | Agents giving irrelevant answers due to missing context; agents losing work when sessions end; agents conflicting with each other |

## Value Proposition

**For Users**:
- **Context-aware agents** — Agents load project context (architecture, conventions, decisions) before responding, leading to more relevant and accurate answers
- **Persistent state** — Agent understanding persists across sessions; no need to re-explain project details
- **Coordinated multi-agent workflows** — 30 specialized agents (+ 6 supervisors) with capability-based routing ensure the right agent handles each task
- **Live documentation access** — Context7 integration means agents reference up-to-date API docs, not stale training data
- **Safe AI exploration** — Inferred/verified state split lets agents explore without corrupting verified ground truth

**For Contributors**:
- **Well-documented architecture** — 100+ context files, 6 project-intelligence files, 823-line README provide comprehensive understanding
- **Testable abstractions** — RuntimeAdapter, event system, state management all designed for testability with minimal mocking
- **Clear contribution path** — Skills system (SKILL.md convention) lowers the barrier for third-party contributions
- **Deterministic agent routing** — Metadata-based routing is debuggable and transparent, unlike ML-based approaches

## Success Metrics

| Metric | Definition | Target | Current |
|--------|------------|--------|---------|
| Agent response accuracy | % of agent responses that are contextually correct for the project | >90% | Measuring (new PI files expected to improve this) |
| Context loading time | Time for agent to load and parse all relevant context files | <500ms | <200ms (observed with current context set) |
| State corruption incidents | Number of verified-state corruptions requiring rollback | 0/month | 0 (since snapshot-before-write deployed) |
| Onboarding time | Time for new contributor to make first meaningful PR | <1 week | ~1-2 weeks (PI files expected to reduce this) |
| Context file compliance | % of context files under 200 lines with valid frontmatter | >95% | ~90% (100+ files, some non-compliant frontmatter dates) |

## Business Model (if applicable)

```
Revenue Model: Not applicable — OAC is a platform component of OpenCode (free, open-source)
Pricing Strategy: N/A (part of the OpenCode ecosystem)
Unit Economics: N/A
Market Position: Agent coordination layer within the OpenCode developer tool ecosystem
```

## Key Stakeholders

| Role | Name | Responsibility | Contact |
|------|------|----------------|---------|
| Platform Lead | OpenCode team | Overall architecture, technical direction | Via OpenCode community channels |
| Event System Owner | Platform team | Event processing, RuntimeAdapter, 3-tier routing | Via GitHub issues |
| Context System Owner | Platform team | MVI context system, file organization, standards | Via GitHub issues |
| State System Owner | Platform team | Inferred/verified split, snapshots, schema validation | Via GitHub issues |
| Skills Ecosystem | Community contributors | Skill development, skill standards, skill discovery | Via OpenCode community channels |

## Roadmap Context

**Current Focus**: The OAC platform has reached initial operational capability with all 10 features in place. Current work focuses on:
1. Populating and validating the project-intelligence files (this effort)
2. Stabilizing the Tier 3 deferred event reliability
3. Adding snapshot lifecycle management (TTL-based cleanup)
4. Updating all context file frontmatter dates to current

**Next Milestone**: Context system maturity
- Automated frontmatter validation
- Snapshot TTL cleanup cron
- Tier 3 retry mechanism design
- Effect upstream compatibility evaluation

**Long-term Vision**:
- Full cross-runtime support (Node stable, Deno)
- Community-contributed skill ecosystem with 50+ skills
- Visual context graph for human contributors
- Event-driven multi-agent coordination (agents triggering events for other agents)
- OAC as a standalone npm package usable outside OpenCode

## Business Constraints

- **Zero infrastructure dependency** — OAC must never require Docker, databases, message brokers, or external services for core functionality. This keeps OpenCode portable and fast to set up.
- **CLI-first design** — All OAC capabilities must be accessible via command line. GUI is optional. This ensures scriptability and aligns with developer workflows.
- **Bundle size sensitivity** — As a CLI tool, startup time matters. Dependencies must be lean. The effect smol fork is a direct result of this constraint.
- **Offline-first** — Core functionality (context loading, state management, task management) must work without internet. Only Context7 integration and LLM calls require connectivity.
- **Single-process architecture** — OAC runs within the OpenCode process. No multi-process orchestration is supported. The 3-tier event system uses this single-process model.

## Onboarding Checklist

- [x] Understand the problem statement (agents need infrastructure, not re-implementation)
- [x] Identify target users and their needs (agent developers, platform contributors, end users)
- [x] Know the key value proposition (context-aware agents, persistent state, coordinated workflows)
- [x] Understand success metrics (accuracy, load time, corruption incidents)
- [x] Know who the stakeholders are
- [x] Understand current business constraints (zero-infra, CLI-first, offline-first, single-process)
- [x] Understand the roadmap and current focus areas

## Related Files

- `technical-domain.md` - How this business need is solved technically
- `business-tech-bridge.md` - Mapping between business and technical
- `decisions-log.md` - Business decisions with context
