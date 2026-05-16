---
description: Run the complete testing pipeline
tags:
  - testing
  - pipeline
  - quality
  - type-check
  - lint
---

# Testing Pipeline

This command runs the complete testing pipeline for the project.

## Available Commands

| Command | Description |
|---------|-------------|
| `npm test` | Run all tests once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run type:check` | TypeScript type checking |
| `npm run update:deps` | Update dependencies and check outdated |

## Coverage

Test coverage is tracked in `.opencode/state/inferred/test-coverage/test-coverage-state.json`.

Coverage reports are generated to `.opencode/coverage/` when running `npm run test:coverage`.

**Current coverage targets**:
- `events/handlers/` — 6 handler files
- `events/router/` — 1 router file
- `events/adapters/` — 1 adapter file
- `tool/` — 16 tool module files
- `graph/` — 9 graph engine files

## Usage

To run the complete testing pipeline:

1. `npm run type:check` — Check for type errors
2. `npm test` — Run all tests
3. Review coverage: `npm run test:coverage`
4. Report any failures
5. Fix any failures
6. Repeat until all tests pass
7. Report success