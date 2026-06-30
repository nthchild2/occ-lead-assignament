<!--
TEMPLATE · Verification Report (Phase 4 · VERIFY)

Purpose: the "pre-review" gate. Confirm the change is correct, complete, traceable,
and clean — before a human reviews the PR. Produces an objective pass/fail, not a vibe.

Who fills this: the `verifier` subagent, or a human. The verifier is independent of
the implementer (fresh context) so it isn't anchored on the implementer's intent.

This phase runs three kinds of check:
  1. Coverage matrix      — traceability is complete (mechanical + script-assisted)
  2. Citation spot-check  — research/plan claims are grounded (sampled critic check)
  3. Tooling gate         — tsc + eslint + jest actually pass (the A6 verification gate)

On ANY failure: this is a HARD STOP regardless of autonomy mode. Record the failure,
loop back to PLAN (if the approach was wrong) or IMPLEMENT (if the code was wrong).
-->

# Verification Report · <feature-name>

- **Feature id:** `<kebab-id>`
- **Inputs read:** `00-spec.md`, `02-plan.md`, `03-impl-report.md`
- **Verifier:** <agent / human>
- **Date:** <YYYY-MM-DD>
- **Result:** ✅ PASS | ❌ FAIL

## 1 · Coverage matrix

| R-id | Priority | Has change? | Notes |
| ---- | -------- | ----------- | ----- |
| R1   | must     | ✅          |       |
| R2   | must     | ✅          |       |
| R3   | should   | ✅          |       |

- [ ] **No gaps** — every `must` requirement has ≥1 change.
- [ ] **No orphans** — every change traces to ≥1 requirement (scope-creep check).
- [ ] Out-of-scope items from the ledger were NOT implemented.

## 2 · Citation spot-check

<!-- Sample N citations from 01-research.md / 02-plan.md and confirm the cited
     `path:line` actually says what the doc claims. The validator script already
     proved the paths exist; this checks they're RELEVANT, not just real. -->

| Cited claim                        | `path:line`  | Holds up? |
| ---------------------------------- | ------------ | --------- |
| <claim sampled from research/plan> | `app/...:NN` | ✅ / ❌   |

## 3 · Tooling gate

| Check           | Command                                   | Result  |
| --------------- | ----------------------------------------- | ------- |
| Types (app)     | `pnpm --filter './app' run typecheck`     | ✅ / ❌ |
| Types (backend) | `pnpm --filter './backend' run typecheck` | ✅ / ❌ |
| Lint            | `pnpm lint`                               | ✅ / ❌ |
| Tests           | `pnpm --filter '<touched>' run test`      | ✅ / ❌ |

<!-- Paste the tail of any failing output here so the loop-back has the evidence. -->

## Findings

<!-- Anything a human reviewer should know: judgment calls, residual risk,
     things that pass the gate but deserve a second look. -->

- <finding>

## Verdict

- ✅ **PASS** → ready for human PR review. Summarise for the reviewer below.
- ❌ **FAIL** → loop back to **PLAN** / **IMPLEMENT** (state which and why).

**Reviewer summary (on pass):** <2–3 lines: what shipped, what to look at first.>
