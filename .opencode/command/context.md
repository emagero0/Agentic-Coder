---
description: Context system manager - harvest summaries, extract knowledge, organize context
tags:
  - context
  - knowledge-management
  - harvest
dependencies:
  - subagent:context-organizer
  - subagent:contextscout
---

# Context Manager

<critical_rules priority="absolute" enforcement="strict">
  <rule id="mvi_strict">Files MUST be <200 lines. Core concept 1-3 sentences, 3-5 key points, minimal example, reference link.</rule>
  <rule id="approval_gate">ALWAYS present approval UI before deleting/archiving files. Letter-based selection (A B C or 'all'). NEVER auto-delete.</rule>
  <rule id="function_structure">ALWAYS organize by function: concepts/, examples/, guides/, lookup/, errors/ (not flat files).</rule>
  <rule id="lazy_load">ALWAYS read required context files from .opencode/context/core/context-system/ BEFORE executing operations.</rule>
</critical_rules>

**Arguments**: `$ARGUMENTS`

## Default Behavior (no args)
Quick scan for summary files (*OVERVIEW.md, *SUMMARY.md, SESSION-*.md, CONTEXT-*.md, .tmp/, root files >2KB), then suggest `/context harvest`.

## Operations

### Harvest & Compact
| Command | Action | Reads |
|---------|--------|-------|
| `/context harvest [path]` | Extract knowledge from summaries → permanent context, clean workspace | operations/harvest.md, standards/mvi.md |
| `/context compact {file}` | Minimize file to MVI format | guides/compact.md, standards/mvi.md |

### Custom Creation
| Command | Action | Reads |
|---------|--------|-------|
| `/context extract from {source}` | Extract context from docs/code/URLs | operations/extract.md, standards/mvi.md, guides/compact.md |
| `/context organize {category}` | Restructure flat files → function folders | operations/organize.md, standards/structure.md |
| `/context update for {topic}` | Update context for API/framework changes | operations/update.md, guides/workflows.md |
| `/context error for {error}` | Add recurring error to knowledge base | operations/error.md, standards/templates.md |
| `/context create {category}` | Create new context category with structure | guides/creation.md, standards/structure.md, standards/templates.md |

### Migration & Utility
| Command | Action |
|---------|--------|
| `/context migrate` | Copy global (~/.config/opencode/context/) to local (.opencode/context/) |
| `/context map [category]` | View context structure, file counts |
| `/context validate` | Check integrity, references, file sizes |
| `/context help` | Show all operations |

## Lazy Load Map
| Operation | Required Context |
|-----------|-----------------|
| default, harvest | operations/harvest.md, standards/mvi.md, guides/workflows.md |
| compact | guides/compact.md, standards/mvi.md |
| extract | operations/extract.md, standards/mvi.md, guides/compact.md, guides/workflows.md |
| organize | operations/organize.md, standards/structure.md, guides/workflows.md |
| update | operations/update.md, guides/workflows.md, standards/mvi.md |
| error | operations/error.md, standards/templates.md, guides/workflows.md |
| create | guides/creation.md, standards/structure.md, standards/templates.md |
| migrate | standards/mvi.md |

All files located in `.opencode/context/core/context-system/`

## Subagent Routing
| Operations | Delegated To |
|-----------|--------------|
| harvest, extract, organize, update, error, create, migrate | ContextOrganizer (passes operation name, args, lazy load map) |
| map, validate | ContextScout (passes operation name, args) |

## Examples
`/context` — quick scan, suggests harvest if summaries found
`/context harvest` — clean summaries → permanent context
`/context harvest .tmp/` — clean specific directory
`/context migrate` — copy global context to local project

## Structure
```
.opencode/context/core/context-system/
├── operations/     # harvest, extract, organize, update
├── standards/      # mvi, structure, templates
└── guides/         # workflows, compact, creation
```
