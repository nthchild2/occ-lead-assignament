---
description: AIDLC Phase 1 — run the researcher on a feature and validate its citations.
argument-hint: <feature-id>
allowed-tools: Task, Bash, Read
---

Run the RESEARCH phase for feature **`$1`**.

1. Confirm `docs/work/$1/00-spec.md` exists and its sign-off box is checked. If not, stop and tell the human to approve the ledger first.
2. Launch the `aidlc-researcher` subagent (Task tool, `subagent_type: aidlc-researcher`). Tell it the feature id is `$1` so it reads/writes `docs/work/$1/`.
3. When it returns, run the citation validator:
   `node scripts/aidlc/validate-citations.mjs docs/work/$1`
4. If validation fails, report the bad citations and send them back to the researcher to fix — do not proceed with unresolved citations.
5. If the researcher raised an **AMBIGUITY ESCALATION**, surface it to the human and stop.
6. Summarize the research handoff in 2–3 lines and point the human at `docs/work/$1/01-research.md`.
