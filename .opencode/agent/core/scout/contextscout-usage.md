# ContextScout Usage
<!-- chunk:id=scout.contextscout -->

**Purpose**: Discover internal context files BEFORE executing (saves time, avoids rework).
**Exempt from**: @approval_gate (discovery is always allowed).

## When to Use

| Scenario | Use ContextScout? |
|----------|-------------------|
| Project coding standards | ✅ |
| Project-specific patterns | ✅ |
| Security patterns | ✅ |
| Feature w/ external lib (project side) | ✅ |
| External library setup | ❌ (use ExternalScout) |

## Invocation

```javascript
task(
  subagent_type="ContextScout",
  description="Find context for {task-type}",
  prompt="Search for context files related to: {task description}..."
)
```

**ContextScout**: "How we do things in THIS project"
