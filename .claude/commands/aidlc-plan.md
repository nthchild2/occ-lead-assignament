---
description: AIDLC Phase 2 — run the planner on a feature (the key human gate) and validate citations.
argument-hint: <feature-id>
allowed-tools: Task, Bash, Read
---

Run the PLAN phase for feature **`$1`**.

1. Confirm `docs/work/$1/00-spec.md` and `docs/work/$1/01-research.md` exist. If not, stop and say which phase is missing.
2. Launch the `aidlc-planner` subagent (Task tool, `subagent_type: aidlc-planner`) with the feature id `$1`.
3. When it returns, run the citation validator:
   `node scripts/aidlc/validate-citations.mjs docs/work/$1`
   Send any bad citations back to the planner.
4. If the planner raised an **AMBIGUITY ESCALATION**, surface it to the human and stop.
5. Present the plan to the human for the **key gate**: show the approach, the change list, and the requirement-coverage table from `docs/work/$1/02-plan.md`. Explicitly ask the human to approve before implementation — a flawed plan is far cheaper to fix here than after code is written.

Do not start implementation from this command. Stop at the gate.
