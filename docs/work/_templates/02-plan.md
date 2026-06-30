<!--
TEMPLATE · Implementation Plan (Phase 2 · PLAN)

Purpose: turn the spec + research into a precise, reviewable list of changes BEFORE
any code is written. This is the KEY HUMAN GATE — fixing a bad plan costs a
paragraph, fixing bad code costs a rewrite. In balanced/full-control mode the
orchestrator stops here and waits for human approval.

Who fills this: the `planner` subagent, or a human.

Rules:
- Every planned change cites the R-id(s) it satisfies. A change that cites no
  requirement is scope creep — remove it or raise a new requirement in the ledger.
- Every `must` requirement in the ledger appears in the coverage check below with
  at least one planned change. Gaps are blockers.
- Changes reference the files found in research (`path:line`). No new mystery files
  appear here without justification.
- The plan is a sequence: order changes so the codebase stays type-checkable between
  steps where practical.
-->

# Plan · <feature-name>

- **Feature id:** `<kebab-id>`
- **Inputs read:** `00-spec.md`, `01-research.md`
- **Planner:** <agent / human>
- **Date:** <YYYY-MM-DD>

## Approach

<3–6 sentences: the strategy. Why this shape, what alternative was rejected and why.
Keep it short — the detail lives in the change list.>

## Planned changes

| #   | Change                                              | File(s) (`path:line`)                | R-ids  | Type   |
| --- | --------------------------------------------------- | ------------------------------------ | ------ | ------ |
| 1   | <concrete edit: "add X prop to Y, wire to service"> | `app/core/components/Foo.tsx`        | R1     | edit   |
| 2   | <new file: "create useJobs hook">                   | `app/core/hooks/useJobs.ts` (new)    | R2, R3 | create |
| 3   | <test: "unit test for the store action">            | `app/store/jobs.store.test.ts` (new) | R2     | test   |

Type: `create` | `edit` | `delete` | `test` | `config`.

## Requirement coverage check

<!-- Mechanical. The coverage-matrix script also computes this; filling it here makes
     the gate reviewable at a glance. Every `must` must be covered. -->

| R-id | Priority | Covered by change(s) |
| ---- | -------- | -------------------- |
| R1   | must     | 1                    |
| R2   | must     | 2, 3                 |
| R3   | should   | 2                    |

- [ ] Every `must` requirement is covered by ≥1 change.
- [ ] Every planned change cites ≥1 requirement (no orphans).

## Tests to add or update

<!-- A4 requires this. List the test files and what each asserts, tied to R-ids. -->

- `<test file>` — asserts <behaviour> (R2).

## Risks & rollback

- <what could go wrong, and how a change is reverted if verify fails>

## Handoff to IMPLEMENT

- <the ordered build sequence the implementer should follow, in one line each>

## Sign-off

- [ ] Plan reviewed by a human and approved to proceed to IMPLEMENT.
      (In full-auto mode this is auto-checked; the two hard stops still apply.)
