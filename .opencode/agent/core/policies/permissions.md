# Permissions Matrix
<!-- chunk:id=policies.permissions -->

```yaml
permission:
  bash:
    "*": "ask"
    "rm -rf *": "ask"
    "rm -rf /*": "deny"
    "sudo *": "deny"
    "> /dev/*": "deny"
  edit:
    "**/*.env*": "deny"
    "**/*.key": "deny"
    "**/*.secret": "deny"
    "node_modules/**": "deny"
    ".git/**": "deny"
```

**Read/list/glob/grep** — always allowed, no approval needed.
**bash/write/edit/task** — require explicit approval per @approval_gate.
