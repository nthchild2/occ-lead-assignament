<!--
TEMPLATE · Implementation Report (Phase 3 · IMPLEMENT)

Purpose: record exactly what changed and tie every change back to a requirement and
a plan step. This is what makes "only make changes we can trace" auditable. A
reviewer reads this instead of reverse-engineering the diff.

Who fills this: the `implementer` subagent, or a human, AFTER writing the code.

Rules:
- Every change listed cites the R-id(s) it satisfies AND the plan step it came from.
- A change that doesn't trace to the plan is either an unplanned necessity (justify it
  explicitly under "Deviations") or scope creep (shouldn't be here).
- Report what was actually done, including anything that diverged from the plan and why.
- Do not claim verification here — that's Phase 4. This report states what changed;
  verify decides whether it's correct and complete.
-->

# Implementation Report · <feature-name>

- **Feature id:** `<kebab-id>`
- **Inputs read:** `00-spec.md`, `02-plan.md`
- **Implementer:** <agent / human>
- **Date:** <YYYY-MM-DD>

## Changes made

| File (`path`)                        | What changed                         | R-ids  | Plan step |
| ------------------------------------ | ------------------------------------ | ------ | --------- |
| `app/core/components/Foo.tsx`        | <what was added/edited, in one line> | R1     | 1         |
| `app/core/hooks/useJobs.ts` (new)    | <what this file does>                | R2, R3 | 2         |
| `app/store/jobs.store.test.ts` (new) | <what it asserts>                    | R2     | 3         |

## Traceability

<!-- The reviewer's quick check. Mirrors the plan's coverage table, now as-built. -->

| R-id | Satisfied by (file)                | Notes |
| ---- | ---------------------------------- | ----- |
| R1   | `app/core/components/Foo.tsx`      |       |
| R2   | `app/core/hooks/useJobs.ts` + test |       |
| R3   | `app/core/hooks/useJobs.ts`        |       |

## Deviations from the plan

<!-- Anything done differently than 02-plan.md, with the reason. "None" is a valid
     answer. An undocumented deviation is the thing verify will catch. -->

- <plan step N> → <what changed and why> · or · **None.**

## Anything left for a follow-up

<!-- Out-of-scope things noticed but deliberately NOT done (would be new R-ids /
     a separate feature). Keeps scope honest. -->

- <observation> — not done because <out of scope / new requirement needed>.

## Handoff to VERIFY

- Workspaces touched (for `tsc`): <app | backend | packages/shared>
- New/changed tests to run: <paths>
- Anything the verifier should pay special attention to: <…>
