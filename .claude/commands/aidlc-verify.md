---
description: AIDLC Phase 4 — run the independent verifier (coverage + citations + tooling gate).
argument-hint: <feature-id>
allowed-tools: Task, Bash, Read
---

Run the VERIFY phase for feature **`$1`**.

1. Confirm `docs/work/$1/03-impl-report.md` exists. If not, stop — there's nothing to verify yet.
2. Run the coverage checker so the verifier (and you) start from an objective traceability result:
   `node scripts/aidlc/check-coverage.mjs docs/work/$1`
3. Launch the `aidlc-verifier` subagent (Task tool, `subagent_type: aidlc-verifier`) with the feature id `$1`. It independently re-runs the three checks — coverage matrix, citation spot-check, and the `tsc`/`eslint`/`jest` tooling gate — and writes `docs/work/$1/04-verify.md`.
4. Read the verdict:
   - **PASS** → report the reviewer summary; the feature is ready for human PR review.
   - **FAIL** → this is a hard stop. Report the failure and the verifier's loop-back target (PLAN or IMPLEMENT), with the evidence. The run does not proceed.
