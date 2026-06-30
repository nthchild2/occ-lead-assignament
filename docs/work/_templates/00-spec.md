<!--
TEMPLATE · Requirements Ledger (Phase 0 · SPEC)

Purpose: decompose a feature request / spec into atomic, testable requirements
with stable IDs. Every downstream artifact (research, plan, impl-report, verify)
references these IDs. This is the spine of traceability — if a change can't cite
an R-id here, it shouldn't exist; if an R-id here has no change, the work isn't done.

Who fills this: a human, or the orchestrator with human approval. The SPEC gate
is always a human gate — the ledger is the contract the rest of the run is held to.

Rules:
- One requirement = one atomic, independently testable behaviour. If you need
  "and" to describe it, split it.
- Each R gets a stable id (R1, R2, …). Never renumber; if a requirement is dropped,
  mark it WITHDRAWN, don't reuse the id.
- "Source" points at where the requirement comes from (PDF page, spec section,
  issue link). "Acceptance" is how a human/agent confirms it's met.
- Out-of-scope items are listed explicitly. The implementer treats anything not in
  this ledger as scope creep, to be flagged not built.
-->

# Spec · <feature-name>

- **Feature id:** `<kebab-id>` (matches the `docs/work/<feature>/` directory name)
- **Date:** <YYYY-MM-DD>
- **Author:** <human name / "orchestrator, approved by <name>">
- **Source spec:** <PDF / doc / issue link>

## Summary

<2–4 sentences. What is being built and why. Plain language.>

## Requirements ledger

| ID  | Requirement (atomic, testable) | Source         | Acceptance criterion                        | Priority |
| --- | ------------------------------ | -------------- | ------------------------------------------- | -------- |
| R1  | <single behaviour>             | <PDF p.X / §Y> | <observable condition that proves it's met> | must     |
| R2  | <single behaviour>             | <PDF p.X / §Y> | <observable condition>                      | must     |
| R3  | <single behaviour>             | <issue #N>     | <observable condition>                      | should   |

Priority: `must` | `should` | `could` (MoSCoW). `could` items are dropped first
under time pressure and must be explicitly confirmed before implementation.

## Explicitly out of scope

- <thing a reader might assume is included but isn't, and why>
- <…>

## Open questions / ambiguities

<!-- Anything the spec doesn't pin down. The run CANNOT proceed past PLAN with an
     unresolved blocking question — these are the "ambiguity escalation" hard stops.
     Resolve with a human, record the answer here, then continue. -->

- [ ] <question> → **resolution:** <answer, once known>

## Sign-off

- [ ] Ledger reviewed by a human and approved to proceed to RESEARCH.
