# `docs/work/` — AIDLC run artifacts

This directory holds the **handoff documents** produced by the AI-Assisted Development Lifecycle (see [A6](<../A6 · AI-Assisted Development Lifecycle.md>)). Each feature gets its own subdirectory; each phase writes one document. The documents are committed — they're the permanent, auditable trace of how a change was researched, planned, built, and verified.

## Layout

```
docs/work/
├── _templates/              ← the contracts — copy these to start a run
│   ├── 00-spec.md           ← requirements ledger (R-ids)
│   ├── 01-research.md       ← file map + constraints, every claim cited
│   ├── 02-plan.md           ← change list citing R-ids   ← key human gate
│   ├── 03-impl-report.md    ← changes as-built, traced to R-ids
│   └── 04-verify.md         ← coverage matrix + tooling gate
└── <feature-id>/            ← one directory per feature, e.g. job-search-screen/
    ├── 00-spec.md
    ├── 01-research.md
    ├── 02-plan.md
    ├── 03-impl-report.md
    └── 04-verify.md
```

## Starting a run

1. Create `docs/work/<feature-id>/` (kebab-case, matches the ledger's feature id).
2. Copy `00-spec.md` from `_templates/`, fill the requirements ledger, get human sign-off.
3. The orchestrator drives the remaining phases per the gate policy (see A6). Each phase
   reads the prior artifacts and writes its own.

## The phases produce a chain of custody

```
00-spec  ──R-ids──▶ 01-research ──cites files──▶ 02-plan ──cites R-ids──▶
   03-impl-report ──traces to R-ids + plan──▶ 04-verify ──coverage + gate──▶ PR
```

Every link is checkable: research claims cite `path:line` (validated mechanically),
plan changes cite requirements (coverage matrix), the impl report traces to both,
and verify proves no requirement is unmet and no change is unjustified.

## Why these stay committed

The artifacts are the trace. A reviewer reads `03-impl-report.md` instead of
reverse-engineering the diff; a future contributor sees _why_ a change was made,
not just _that_ it was. This is the same "process is documentation" principle as
the rest of `docs/` (A6 Decision 4).
