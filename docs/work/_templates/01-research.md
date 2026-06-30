<!--
TEMPLATE · Research Handoff (Phase 1 · RESEARCH)

Purpose: map the area of the codebase the feature touches, so the planner starts
from real entry points instead of guessing. This is a NAVIGATION document, not a
content dump — pointers and constraints, not pasted code.

Who fills this: the `researcher` subagent (read-only), or a human.

THE CITATION RULE (enforced):
- Every factual claim about the codebase carries a `path:line` (or `path:line-line`)
  in the Source column. A finding with no source is invalid and rejected at the gate.
- The citation validator script checks each path exists and the line is in range.
  A fabricated path fails mechanically. Don't cite from memory — open the file.

Compression rule: this doc is deliberately lossy. Capture WHERE things are and
WHAT constrains the change. Do not paste file bodies. If the planner needs the
detail, the citation tells it exactly where to look.
-->

# Research · <feature-name>

- **Feature id:** `<kebab-id>`
- **Inputs read:** `00-spec.md`, `docs/MAP.md`, <other docs>
- **Researcher:** <agent / human>
- **Date:** <YYYY-MM-DD>

## Relevant files

| File (`path:line`)                  | Why it matters to this feature                        | R-ids  |
| ----------------------------------- | ----------------------------------------------------- | ------ |
| `app/core/components/Button.tsx:34` | <one line: what's here and why the change touches it> | R1     |
| `app/store/jobs.store.ts:18`        | <…>                                                   | R2, R3 |

Every row maps to ≥1 requirement. If a file matters but maps to no requirement,
say why in Notes — it may be a hidden dependency or a sign of scope creep.

## Existing patterns to follow

<!-- The "how is X done here" answer that keeps the implementer on-rails.
     Each must cite a real example in the codebase. -->

- **<e.g. building a component>** → follow `app/core/components/Card.tsx:36`; must
  consume tokens via `useTheme()` (`app/core/hooks/useTheme.ts:6`), no inline literals.
- **<e.g. a Zustand store>** → follow `app/store/theme.store.ts:19`; one store per domain.

## Constraints that apply

<!-- Pulled from A1–A6 / CLAUDE.md, each cited. These are the guardrails the plan
     must respect. -->

- `core/` must not import from `app/` — `.eslintrc.js:33` (rationale: A1 Decision 2).
- No `any`; API types via `z.infer<>` — `.eslintrc.js:13`.
- <…>

## What NOT to touch

<!-- Explicit no-go list. Files/areas that look related but must stay untouched,
     to bound the blast radius. -->

- <path/area> — <why it's off-limits>

## Risks & unknowns

- <anything the research surfaced that the plan must resolve, or that should be
  escalated to a human before planning>

## Handoff to PLAN

<!-- The compressed "what the next phase needs". 3–6 bullets max. -->

- <the essential orientation the planner needs, in pointer form>
