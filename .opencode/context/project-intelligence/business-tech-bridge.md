<!-- Context: project-intelligence/bridge | Priority: high | Version: 1.0 | Updated: 2026-05-12 -->

# Business ↔ Tech Bridge

> Document how business needs translate to technical solutions. This is the critical connection point.

## Quick Reference

- **Purpose**: Show stakeholders technical choices serve business goals
- **Purpose**: Show developers business constraints drive architecture
- **Update When**: New features, refactoring, business pivot

## Core Mapping

| Business Need | Technical Solution | Why This Mapping | Business Value |
|---------------|-------------------|------------------|----------------|
| Agent needs to react to real-time events | 3-tier event processing system (sync/async/deferred) | Different event urgencies require different execution guarantees and priorities | Agents respond to user actions instantly (sync), process background tasks (async), and perform maintenance (deferred) without blocking |
| Agents need project knowledge to be effective | MVI context system with 100+ files across 6 categories | Structured, scannable context files enable agents to load only what they need | Agents provide more relevant, context-aware responses with less token overhead |
| Agents must reason about complex relationships | Graph reasoning layer (BFS, DFS, blast radius, cycle detection) | Graph traversal directly models dependency relationships that linear reasoning cannot capture | Agents can analyze blast radius of changes, detect dependency cycles, and plan multi-step operations |
| AI-generated state must not corrupt verified state | Inferred/verified state split with schema validation | A hard partition prevents accidental promotion of unverified AI output into authoritative state | Safer agent autonomy — AI can explore and infer without risk of corrupting ground truth |
| Platform must support many agent specializations | 30 agents across 7 categories with metadata-based routing | Capability metadata enables routing to the right agent without hardcoded dispatch | Users get the right specialist agent for each task without manual selection |
| Agents must be extensible via skills | 5 skills system with SKILL.md convention | Standardized skill interface enables third-party contributions | The platform grows with the community; users add new capabilities without touching core code |
| Developers need comprehensive documentation | 823-line README, comprehensive context docs, project-intelligence | Centralized, well-organized documentation reduces learning curve | New contributors onboard faster; fewer interruptions for maintainers |
| Developers need structured task management | CLI-integrated task management with 8 commands | CLI workflow matches developer habits (terminal-based, scriptable) | Tasks are managed without leaving the terminal; automatable via scripts |
| Agents need live documentation during problem-solving | Context7 API integration for live library docs | Real-time API documentation is more accurate than static snapshots | Agents provide up-to-date answers about library usage, not stale training data |
| UI components must be quickly composable | Shadcn component system with registry discovery | Registry-based components are copy-paste installable, no build tool lock-in | Developers build UIs faster with pre-built, customizable components |

## Feature Mapping Examples

### Feature: Event Processing System

**Business Context**:
- User need: Agent must respond to user input, check dependencies, and perform maintenance without blocking
- Business goal: Provide real-time agent responsiveness with background processing capability
- Priority: Critical — this is the core execution engine

**Technical Implementation**:
- Solution: 3-tier event system with priority routing table, 7 handlers, and RuntimeAdapter
- Architecture: Tier 1 (sync: update-registry, invalidate-cache, session-manager), Tier 2 (async: check-dependencies, analyze-drift), Tier 3 (deferred: weekly-audit, ecosystem-watch, session-manager)
- Trade-offs: Priority routing table (chosen) vs. message queue infrastructure. Opted for simplicity over delivery guarantees for Tier 3 events.

**Connection**:
The 3-tier design maps directly to business urgency: sync events keep the agent responsive (user-facing latency <50ms), async events enable deep analysis without blocking the user, and deferred events handle maintenance that should happen but not during active sessions. Without this system, a slow audit task could block user interaction.

### Feature: Context Management System

**Business Context**:
- User need: Agents must understand the project they're operating in — its architecture, conventions, and state
- Business goal: Reduce agent errors caused by missing or ambiguous project context
- Priority: High — without context, agents hallucinate project-specific details

**Technical Implementation**:
- Solution: MVI context system with 100+ files across 6 function-based categories (concepts/ examples/ guides/ lookup/ errors/)
- Architecture: Each file under 200 lines, focused on one topic, with frontmatter metadata for agent routing
- Trade-offs: Function-based (chosen) vs. topic-based vs. monolithic. Function-based makes it clear where each piece of knowledge belongs.

**Connection**:
Every piece of project knowledge lives in exactly one file. Agents load the navigation.md first, then drill into the relevant category. This means an agent troubleshooting an error reads the errors/ directory, not the entire docs corpus. Result: faster, more accurate agent responses with lower token costs.

### Feature: Cognitive Platform (Graph Reasoning)

**Business Context**:
- User need: Agents must understand dependencies between concepts, services, and decisions in a project
- Business goal: Enable agents to answer "what happens if we change X?" and find root causes
- Priority: High — makes agents useful for architecture and planning tasks, not just code generation

**Technical Implementation**:
- Solution: Graph reasoning layer with BFS (breadth-first search), DFS (depth-first search), blast radius analysis, and cycle detection
- Architecture: Cache-backed prompt compilation with 3 cache tiers (L1 memory, L2 disk, L3 computed)
- Trade-offs: Graph approach (chosen) vs. vector embeddings vs. rule-based reasoning. Graph traversal is deterministic and explainable, unlike embedding similarity search.

**Connection**:
Business stakeholders need to understand the impact of changing a service, upgrading a dependency, or deprecating an API. The graph reasoning layer answers "which services depend on this library?" (blast radius) and "is there a circular dependency?" (cycle detection) with deterministic results — crucial for production decision-making.

### Feature: State Management

**Business Context**:
- User need: Agents must save and restore their understanding without corrupting previously verified data
- Business goal: Enable long-running agent sessions with safe state persistence
- Priority: High — state corruption would erode user trust in the platform

**Technical Implementation**:
- Solution: Inferred/verified state split with timestamped snapshots and Zod schema validation
- Architecture: Inferred state is tagged and stored separately; promotion to verified requires explicit review. Snapshot-before-write ensures rollback capability.
- Trade-offs: Snapshot-before-write (chosen) vs. database transactions vs. WAL. Filesystem snapshots are simpler and sufficient for the state volume.

**Connection**:
The inferred/verified split protects business-critical data. An AI agent might infer that "the user wants PostgreSQL" from a conversation, but that inference should not become project configuration without human review. The split creates a safe exploration space (inferred) and a stable production space (verified).

### Feature: Agent System

**Business Context**:
- User need: Different tasks need different agent specializations (e.g., coding, documentation, testing)
- Business goal: Provide best-in-class assistance for each task type
- Priority: High — this is the core value proposition of OAC

**Technical Implementation**:
- Solution: 30 agents across 7 categories (core, meta, content, data, testing, development, supervisory) with metadata and capability routing
- Architecture: Each agent registers its capabilities; the routing layer matches task requests to the best-fit agent
- Trade-offs: Metadata-based routing (chosen) vs. single monolithic agent vs. LLM-routed. Metadata routing is deterministic, debuggable, and fast.

**Connection**:
Users don't want a one-size-fits-all agent. A code generation task routed to a documentation specialist would produce poor results. The agent system ensures each task reaches the agent with the right capability profile, improving output quality and user satisfaction.

### Feature: Skills System

**Business Context**:
- User need: The platform must grow with the community via plugins and extensions
- Business goal: Create an ecosystem where third-party developers contribute capabilities
- Priority: Medium — important for growth, not for MVP

**Technical Implementation**:
- Solution: 5 skills (context7, task-management, find-skills, shadcn, shadcn-discovery) with SKILL.md convention
- Architecture: Skills are discovered via skill tool loading; each skill has a standardized metadata file and inline documentation
- Trade-offs: SKILL.md convention (chosen) vs. plugin SDK vs. npm packages. SKILL.md is simpler for contributors and requires no build step.

**Connection**:
The skills system transforms OpenCode from a fixed-capability tool into a platform. Third-party developers can write a SKILL.md file and contribute new capabilities without understanding the full OAC architecture. This lowers the contribution barrier and accelerates ecosystem growth.

### Feature: Documentation System

**Business Context**:
- User need: Developers (both human and AI) need comprehensive, well-organized documentation
- Business goal: Reduce onboarding time and support burden
- Priority: High — poor documentation creates continuous support overhead

**Technical Implementation**:
- Solution: 823-line README, comprehensive context docs, project-intelligence files
- Architecture: Documentation organized in layers — README (high-level), context system (operational knowledge), project-intelligence (project-specific)
- Trade-offs: Context-system approach (chosen) vs. external wiki vs. README-only. Context system integrates docs into agent workflow.

**Connection**:
The layered documentation approach serves both humans (README, business-domain.md) and agents (context files with frontmatter). New developers can read the README for quick start, the project-intelligence files for strategic understanding, and the context files for operational details. This reduces onboarding from weeks to days.

### Feature: Task Management Workflow

**Business Context**:
- User need: Developers and agents need structured task tracking integrated into the development workflow
- Business goal: Eliminate the context-switch between IDE (or agent) and external task trackers
- Priority: Medium — valuable for productivity, not critical for core functionality

**Technical Implementation**:
- Solution: CLI-integrated task management with 8 commands (create, list, update, delete, start, complete, depend, validate)
- Architecture: Commands operate on local `.opencode/tasks/` directory; tasks are markdown files with structured frontmatter
- Trade-offs: CLI-local (chosen) vs. GitHub Issues API vs. Jira integration. CLI-local works offline and is trivially scriptable.

**Connection**:
Task management at the CLI means developers never leave their terminal. The 8-command interface is learnable in minutes. Integration with the task-management skill means agents can create, update, and complete tasks autonomously, closing the loop between agent work and project tracking.

### Feature: Context7 Integration

**Business Context**:
- User need: Agents need to reference up-to-date documentation for libraries and frameworks during problem-solving
- Business goal: Agents should not rely on potentially stale training data for library-specific knowledge
- Priority: Medium — improves agent accuracy, not required for basic functionality

**Technical Implementation**:
- Solution: Context7 API integration for live library documentation retrieval
- Architecture: The context7 skill calls the Context7 API with a library/version query and returns formatted documentation
- Trade-offs: Live API (chosen) vs. bundled docs vs. web scraping. Live API provides structured, versioned documentation with reliable formatting.

**Connection**:
Agents answering library-specific questions (e.g., "how do I use effect@4's `Effect.gen`?") can retrieve the exact API signature from Context7 instead of relying on training data that may be wrong for the installed version. This eliminates a major source of hallucination.

### Feature: Shadcn Component System

**Business Context**:
- User need: Developers building UIs need a rich set of pre-built, customizable components
- Business goal: Accelerate UI development and ensure visual consistency across projects
- Priority: Low-Medium — important for UI-heavy projects, not for all OAC users

**Technical Implementation**:
- Solution: Shadcn component system with registry discovery, managed via shadcn skill at ~/.agents/skills/
- Architecture: Components are sourced from registries (shadcn/ui, Magic UI, Aceternity, etc.) and added on-demand via CLI
- Trade-offs: Registry-based (chosen) vs. npm package vs. in-house design system. Registries provide community-maintained components with no build tool lock-in.

**Connection**:
The shadcn system enables developers to compose UIs from tested, accessible components rather than building from scratch. The component discovery skill finds the best components across the ecosystem, so developers don't waste time evaluating alternatives.

## Trade-off Decisions

When business and technical needs conflict, document the trade-off:

| Situation | Business Priority | Technical Priority | Decision Made | Rationale |
|-----------|-------------------|-------------------|---------------|-----------|
| Tier 3 deferred events reliability | Want guaranteed execution for audits | Want zero infrastructure dependencies | Best-effort deferred tier | Simplicity wins over audit guarantees for MVP; retry mechanism planned |
| State snapshot storage growth | Want all history preserved indefinitely | Want bounded storage usage | TTL-based cleanup planned | Cleanup is deferred as non-critical; devs manually prune in the meantime |
| Effect smol fork vs. upstream | Want minimum bundle size | Want full effect ecosystem compatibility | Keep smol fork for now | Bundle size > ecosystem access at current stage; re-evaluate next major version |
| Context7 API dependency | Want up-to-date library docs | Want offline-capable agent | Live API with graceful offline degradation | API dependency is acceptable since docs accuracy > offline capability |
| Single monolithic agent vs. specialized agents | Want one simple interface | Want best output quality per task | Specialized agents with routing | Output quality wins over interface simplicity; routing transparent to users |

## Common Misalignments

| Misalignment | Warning Signs | Resolution Approach |
|--------------|---------------|---------------------|
| RuntimeAdapter scope creep | Adapter interface growing beyond I/O primitives (e.g., HTTP client, crypto) | Review at PR: adapter concerns are ONLY runtime-provided primitives. Push higher-level abstractions to their own modules. |
| MVI file size drift | Context files approaching 200 lines; code review comments about "too much in one file" | Enforce size check in CI; split files aggressively. If a single topic exceeds 200 lines, it's multiple topics. |
| Inferred state bypass | Commits that directly write to verified state without the promotion gate | Code review must flag writes to `state/verified/` without a preceding `state/inferred/` entry. |
| Agent routing ambiguity | Tasks routed to wrong agent; capability metadata missing or overlapping | Audit agent capability registrations quarterly; ensure each agent has a unique, non-overlapping capability signature. |

## Stakeholder Communication

This file helps translate between worlds:

**For Business Stakeholders**:
- Shows that technical investments serve business goals
- Provides context for why certain choices were made
- Demonstrates ROI of technical decisions

**For Technical Stakeholders**:
- Provides business context for architectural decisions
- Shows the "why" behind constraints and requirements
- Helps prioritize technical debt with business impact

## Onboarding Checklist

- [x] Understand the core business needs this project addresses
- [x] See how each major feature maps to business value
- [x] Know the key trade-offs and why decisions were made
- [x] Be able to explain to stakeholders why technical choices matter
- [x] Be able to explain to developers why business constraints exist
- [x] Understand how all 10 features connect business to technical

## Related Files

- `business-domain.md` - Business needs in detail
- `technical-domain.md` - Technical implementation in detail
- `decisions-log.md` - Decisions made with full context
- `living-notes.md` - Current open questions and issues
