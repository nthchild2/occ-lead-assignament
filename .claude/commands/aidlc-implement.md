---
description: AIDLC Phase 3 — run the implementer on an approved plan.
argument-hint: <feature-id>
allowed-tools: Task, Bash, Read
---

Run the IMPLEMENT phase for feature **`$1`**.

1. Confirm `docs/work/$1/02-plan.md` exists and its sign-off box is checked. If the plan isn't approved, stop — implementation only runs on an approved plan.
2. Launch the `aidlc-implementer` subagent (Task tool, `subagent_type: aidlc-implementer`) with the feature id `$1`.
3. If the implementer raised an **ESCALATION** (the plan was wrong), surface it to the human and stop — do not let it improvise a redesign.
4. When it returns, summarize what changed from `docs/work/$1/03-impl-report.md`, note any documented deviations, and tell the human the next step is `/aidlc-verify $1`.

Do not declare the work verified — that's Phase 4, run by an independent verifier.
