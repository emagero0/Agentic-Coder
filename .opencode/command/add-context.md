---
description: Interactive wizard to add project patterns using Project Intelligence standard
tags: [context, onboarding, project-intelligence, wizard]
dependencies:
  - subagent:context-organizer
  - context:core/context-system/standards/mvi.md
  - context:core/context-system/standards/frontmatter.md
  - context:core/standards/project-intelligence.md
---

<critical_rules priority="absolute" enforcement="strict">
  <rule id="project_intelligence">MUST create technical-domain.md in project-intelligence/ dir</rule>
  <rule id="frontmatter_required">ALL files MUST start w/ HTML frontmatter</rule>
  <rule id="mvi_compliance">Files MUST be <200 lines, scannable <30s. MVI: 1-3 sentence concept, 3-5 key points, 5-10 line example, ref link</rule>
  <rule id="navigation_update">MUST update navigation.md when creating/modifying files</rule>
</critical_rules>

## Usage
```
/add-context            Interactive wizard (default: local .opencode/)
/add-context --update   Update existing context
/add-context --global   Save to ~/.config/opencode/ instead
```

## Workflow
1. Resolve path: `.opencode/context/project-intelligence/` or `--global` path
2. Check `.tmp/` for external context files; offer harvest via `/context harvest`
3. Detect existing context files → Review / Add / Replace options
4. Ask 6 questions sequentially:
   - Tech stack (framework, language, db, styling)
   - API endpoint example (paste or skip)
   - Component example (paste or skip)
   - Naming conventions (files, components, variables, functions)
   - Code standards (lint, testing, types, formatting)
   - Security requirements (auth, validation, secrets)
5. Generate compact output:
   ```
   # Technical Domain
   ## Tech Stack: {framework}, {lang}, {db}, {styling}
   ## API Patterns: {1-3 line example}
   ## Components: {1-3 line example}
   ## Conventions: Files={x} | Components={x} | Functions={x}
   ## Standards: {lint, testing, types}
   ## Security: {auth, validation}
   ## Codebase References: {file paths}
   ```
6. Show preview, confirm, write to `$CONTEXT_DIR/technical-domain.md` + `navigation.md`
7. Validate: <200 lines, has frontmatter, navigation updated

## ContextOrganizer delegation
```
operation: create|update
template: technical-domain
target_directory: project-intelligence
user_responses: {tech_stack, api_pattern, component_pattern, naming, standards, security}
validation: {max_lines: 200, has_frontmatter: true, navigation_updated: true}
```

No box-drawing UI, one question at a time, compact output only.
