<!-- Context: project-intelligence/nav | Priority: high | Version: 1.0 | Updated: 2026-05-12 -->

# Project Intelligence

> Start here for quick project understanding. These files bridge business and technical domains for the OpenCode OAC (Open Agent Coordinator) project.

## Structure

```
.opencode/context/project-intelligence/
├── navigation.md              # This file — quick overview
├── business-domain.md         # Business context and problem statement
├── technical-domain.md        # Stack, architecture, technical decisions
├── business-tech-bridge.md    # How 10 features map business needs → technical solutions
├── decisions-log.md           # 5 major decisions with rationale and alternatives
└── living-notes.md            # Active issues, debt, open questions, patterns
```

## Quick Routes

| What You Need | File | Description |
|---------------|------|-------------|
| Understand the "why" | `business-domain.md` | Problem, users, value proposition, roadmap |
| Understand the "how" | `technical-domain.md` | Stack, architecture, integrations, constraints |
| See the connection | `business-tech-bridge.md` | 10 features mapped business → technical |
| Know the context | `decisions-log.md` | 5 key decisions with alternatives considered |
| Current state | `living-notes.md` | Active issues, tech debt, patterns & gotchas |
| All of the above | Read all files in order | Full project intelligence |

## Usage

**New Team Member / Agent**:
1. Start with `navigation.md` (this file)
2. Read all files in order for complete understanding
3. Follow onboarding checklist in each file

**Quick Reference**:
- Business focus → `business-domain.md`
- Technical focus → `technical-domain.md`
- Decision context → `decisions-log.md`

## Integration

This folder is referenced from:
- `.opencode/context/core/standards/project-intelligence.md` (standards and patterns)
- `.opencode/context/core/system/context-guide.md` (context loading)

See `.opencode/context/core/context-system.md` for the broader context architecture.

## Maintenance

Keep this folder current:
- Update when business direction changes
- Document decisions as they're made
- Review `living-notes.md` regularly
- Archive resolved items from decisions-log.md and living-notes.md

**Management Guide**: See `.opencode/context/core/standards/project-intelligence-management.md` for complete lifecycle management including:
- How to update, add, and remove files
- How to create new subfolders
- Version tracking and frontmatter standards
- Quality checklists and anti-patterns
- Governance and ownership

See `.opencode/context/core/standards/project-intelligence.md` for the standard itself.
