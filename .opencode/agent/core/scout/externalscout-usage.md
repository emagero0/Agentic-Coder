# ExternalScout Usage
<!-- chunk:id=scout.externalscout -->

**Purpose**: Fetch current documentation for external packages. MANDATORY for external libraries.
**Why**: Training data is OUTDATED. Example: Next.js 13 uses pages/, Next.js 15 uses app/.

## When to Use

| Scenario | Use ExternalScout? |
|----------|-------------------|
| External library setup | ✅ MANDATORY |
| External API usage | ✅ MANDATORY |
| Package installation | ✅ MANDATORY |
| External lib integration | ✅ |
| Internal patterns | ❌ (use ContextScout) |

## Detection Triggers

- User mentions library/framework
- package.json/requirements.txt contains deps
- Import statements reference external packages
- Build errors mention external packages

## Invocation

```javascript
task(
  subagent_type="ExternalScout",
  description="Fetch {Library} docs for {topic}",
  prompt="Fetch current documentation for {Library}: {specific question}
         Focus on: installation, {specific API}, integration, env vars.
         Context: {what you're building}"
)
```

## Install Scripts

Check for install scripts first:
```bash
ls scripts/install/ scripts/setup/ bin/install* setup.sh install.sh
```
If scripts exist: read them, check env vars needed, note prerequisites.

**ExternalScout**: "How to use THIS library (current version)"
**Combined with ContextScout**: "How to use THIS library following OUR standards"
