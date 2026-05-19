# Tasks: [FEATURE]

**Format**: `[ID] [P] [Story] Description + file paths`

## Phase 1: Setup
- T001 Create project structure
- T002 [P] Initialize deps
- T003 [P] Configure linting

## Phase 2: Foundation (blocks all stories)
- T004 Schema + migrations
- T005 [P] Auth framework
- T006 [P] Base models

## Phase 3: US1 — [TITLE] (MVP)
- T007 [P] [US1] Model: `src/models/...`
- T008 [US1] Service: `src/services/...`
- T009 [US1] API: `src/api/...`

## Phase 4: US2 — [TITLE]
- T010 [P] [US2] Model
- T011 [US2] Service

## Execution Order
- **P1** → P2 → P3 (sequential priority)
- Tasks marked `[P]` run in parallel
- Tests before implementation
