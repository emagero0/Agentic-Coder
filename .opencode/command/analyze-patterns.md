---
id: analyze-patterns
name: analyze-patterns
description: "Analyze codebase for patterns and similar implementations"
type: command
category: analysis
version: 1.0.0
tags:
  - analysis
  - patterns
  - code-quality
  - refactoring
---

# Command: analyze-patterns

Analyze codebase for recurring patterns, similar implementations, and refactoring opportunities.

## Usage
`/analyze-patterns [--pattern=<string>] [--language=<lang>] [--depth=<level>] [--output=<format>]`

## Parameters
| Parameter | Required | Description |
|-----------|----------|-------------|
| `--pattern` | No | Pattern name or regex (e.g. "singleton", "error-handling") |
| `--language` | No | Filter: js, ts, py, go, rust, java |
| `--depth` | No | shallow (current dir) | medium (src/) | deep (entire repo) |
| `--output` | No | text (default) | json | markdown |

## Behavior
1. Parse parameters, validate pattern syntax
2. Search codebase using glob + grep
3. Analyze semantic similarity of matches
4. Group results by pattern + similarity
5. Generate refactoring suggestions
6. Format output per requested format

## Output Format
```
Pattern Analysis Report
Pattern: [name] | Occurrences: [count] | Files: [list]
Implementations:
  1. [file:line] - [description] (similarity: X%)
Refactoring Suggestions:
  - [suggestion]
Quality Insights:
  - [insight]
```

## Examples
`/analyze-patterns --pattern="error-handling" --language=ts` — find all error handling patterns
`/analyze-patterns --pattern="singleton" --depth=deep --output=json` — export to JSON

## Predefined Patterns
JS/TS: singleton, factory, observer, error-handling, async-patterns, api-endpoint, middleware
Python: decorator, context-manager, error-handling, async-patterns, class-patterns
Go: interface-patterns, error-handling, goroutine-patterns, middleware
Custom regex patterns also supported.

## Delegation
Delegates to: **opencoder** (uses context search capabilities for pattern matching)
