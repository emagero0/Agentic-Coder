# Template Resolution Stack

Priority order (highest to lowest):

1. **Project** `.opencode/templates/` — user's overrides
2. **Presets** `.opencode/presets/<name>/templates/` — reusable config bundles
3. **Extensions** `.opencode/extensions/<name>/templates/` — third-party addons
4. **Core** — shipped with opencode runtime

## Resolution Rules

- Template resolution uses the **same name** lookup across all layers: e.g. `spec-template.md` in any layer maps to the same command
- Higher layers **replace** (not merge) lower layers for files with the same name
- Partial overrides (single-file replacement) are supported — you don't need to copy the whole layer
- Missing files fall through to the next-lower layer

## Layer Details

### Project (`project`)
- Location: `.opencode/templates/`
- Scope: single project
- Use: override any template for a specific codebase

### Presets (`presets`)
- Location: `.opencode/presets/<name>/templates/`
- Scope: reusable across projects
- Use: team conventions, framework-specific workflows
- Active preset set in `components.json` or `opencode.json`

### Extensions (`extensions`)
- Location: `.opencode/extensions/<name>/templates/`
- Scope: third-party, installed via package manager
- Use: community templates, plugin-contributed workflows

### Core (`core`)
- Location: opencode installation directory
- Scope: global fallback
- Use: default templates shipped with runtime

## Example

```yaml
# Request: resolve spec-template.md
# Search order:
1. .opencode/templates/spec-template.md         → FOUND → use this
2. .opencode/presets/react/templates/spec-template.md  → skipped
3. .opencode/extensions/some-plugin/templates/  → skipped
4. opencode/core/templates/spec-template.md    → skipped
```
