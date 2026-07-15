# A6 · AI-Assisted Development Lifecycle

## Context

This monorepo was built with AI coding agents (Claude Code) doing the majority of the scaffolding, implementation, and documentation work, under a human lead directing scope, reviewing output, and making the calls AI shouldn't make alone. This document describes that lifecycle as practiced on this exercise — not as a theoretical framework, but as the actual sequence of steps, guardrails, and checkpoints used — so a reviewer can evaluate the process behind the code, not just the code itself.

This is meta-documentation: it doesn't describe a technical decision, it describes how the technical decisions in A1–A5 were arrived at and kept honest.

---

## The lifecycle

```
1. Spec ingestion        →  read the PDF exercise brief, extract hard requirements
2. Architecture-first     →  write A1–A5 before any implementation code
3. Guardrail files         →  CLAUDE.md, copilot-instructions.md encode the rules from A1–A5
                              as machine-readable constraints for future AI sessions
4. Scaffolding             →  monorepo structure, configs, tooling — verified, not assumed
5. Implementation          →  feature code, against the architecture and guardrails
6. Verification gate       →  typecheck + lint + test + expo install --check,
                              every change, before claiming done
7. Review & correction      →  human catches what automated gates can't — process questions,
                              naming, scope creep, things that look right but aren't
8. Docs stay in sync       →  config/process changes get reflected back into A1–A6 in the
                              same unit of work, not as a follow-up
```

This loops, not runs once. Step 6 in particular gated nearly every change in this session — see [Decision 3](#decision-3--the-verification-gate-is-non-negotiable) below for what that actually caught.

---

## Decision 1 · Architecture docs are written before code, and read by the agent before every structural change

### Context

An AI agent with no persistent memory across sessions will re-derive (or worse, re-decide) architectural choices every time it's asked to touch the codebase, unless those choices are written down somewhere it's instructed to read first.

### Decision

A1–A5 are not retrospective documentation — they were written before the corresponding code, and `CLAUDE.md` explicitly tells the agent to read them before making structural changes:

```
## Docs
Architecture decisions are documented in `docs/`. Read them before making
structural changes:
- `docs/A1 · Monorepo Architecture.md`
- `docs/A2 · State & Data Strategy.md`
...
```

This makes the docs load-bearing, not decorative. If `core/` importing from `app/` is forbidden, that rule exists in A1 (the rationale), in `CLAUDE.md` (the instruction), and in `.eslintrc.js` (the enforcement) — three layers, not one.

- A reviewer can audit a PR against a written decision instead of trusting the agent's memory of a prior conversation.
- A future AI session — possibly a different model — gets the same constraints a human lead would have given verbally.
- Architecture changes become visible: changing A1 and changing the folder structure are the same PR.

---

## Decision 2 · Guardrails are duplicated across the tools that actually read them

### Context

Claude Code reads `CLAUDE.md`. GitHub Copilot reads `copilot-instructions.md`. Neither reads the other's file, and neither reads `docs/A1...md` by default unless told to. Pointing both at "see the architecture docs" alone would mean every AI tool re-parses five Markdown files on every invocation, which is slow and inconsistent.

### Decision

Each AI tool gets a short, tool-specific file that restates the load-bearing rules in the form that tool consumes fastest, with `docs/` as the source of truth for the _why_:

- `.github/CLAUDE.md` — for Claude Code: architecture summary, commands, doc index.
- `.github/copilot-instructions.md` — for GitHub Copilot: the same rules, phrased as inline-suggestion constraints ("No `any`", "No fetch in components").

Both files are short on purpose. They're a cache of A1–A5's conclusions, not a replacement for them — if the two ever disagree, `docs/` wins and the guardrail file is stale and needs fixing.

- Each tool gets the constraints in its native format instead of a generic doc dump.
- The duplication is cheap to keep in sync because both files are short — a few lines each, not pages.
- A contributor without AI tooling can still read `docs/` and get the same rules with the reasoning attached.

---

## Decision 3 · The verification gate is non-negotiable

### Context

An AI agent reporting "done" after writing code is not evidence the code works. Type errors, lint violations, and broken tests are cheap to catch immediately and expensive to catch in CI or review.

### Decision

No change is reported complete without running, in this order: `tsc --noEmit` for every touched workspace, `eslint`, `jest`, and `expo install --check` (`pnpm verify` runs all four; CI runs the same gate on every push/PR — see A4 Decision 4). This isn't aspirational — it's what actually happened in this session, and it caught real, non-trivial problems before they reached a commit:

| Caught by the gate          | What it was                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tsc --noEmit` (app)        | `moduleResolution: "bundler"` without `module: "ESNext"` — bootstrap config bug, not an AI-introduced bug, but one that would have blocked every future typecheck silently                                                                                                                                                                                                                                                                                                                                                                |
| `tsc --noEmit` (backend)    | An inferred Express `app` type wasn't portable across pnpm's nested `node_modules` — TS error invisible until `--noEmit` actually ran                                                                                                                                                                                                                                                                                                                                                                                                     |
| `eslint`                    | `eslint-plugin-security@3.x` ships flat config only; `extends: ['plugin:security/recommended']` crashes ESLint outright rather than warning                                                                                                                                                                                                                                                                                                                                                                                               |
| `eslint` (`complexity`)     | A `Button` component exceeded the complexity budget (12 vs. max 10) — caught by the same rule documented in A4, not waived for being "just UI code"                                                                                                                                                                                                                                                                                                                                                                                       |
| `eslint` (`no-unused-vars`) | Express's error-handler middleware signature requires 4 parameters even when one (`_next`) is unused — required adding `argsIgnorePattern: '^_'`, a real config gap, not a false positive to suppress                                                                                                                                                                                                                                                                                                                                     |
| `jest`                      | Confirmed `jest-expo`'s default `transformIgnorePatterns` already handles pnpm's `.pnpm/` nesting — a custom override in `package.json` was actively breaking it                                                                                                                                                                                                                                                                                                                                                                          |
| `expo install --check`      | **Added after an external clean-environment review, not before.** pnpm resolved `babel-preset-expo` to v57 and `react-native-worklets` to 0.6.0 — both newer than what Expo Go SDK 54's precompiled native side ships — and the app red-screened on first boot while `tsc`/`eslint`/`jest` stayed green. The lesson: those three tools never exercise Metro, Babel, or the native runtime, so SDK-version alignment needs its own gate step. Now pinned via `pnpm.overrides` and enforced by this check locally (`pnpm verify`) and in CI |

- None of these were caught by "the code looks right" — they were caught by running the actual tools the PR checklist (A4) requires.
- Several were pre-existing bootstrap bugs, not AI-introduced regressions — the gate doesn't care which; it blocks either.
- The last row is the gate's own post-mortem: the original three-tool gate had a blind spot, an external reviewer's clean-clone run found it, and the fix was to widen the gate rather than patch the symptom — the same "fix the process, not just the bug" rule this document exists to enforce.
- The gate is the same one a human contributor's pre-commit/pre-push hooks run (`.husky/`), so AI-authored and human-authored code are held to an identical bar.

---

## Decision 4 · Process and config fixes update the docs in the same unit of work

### Context

A config fix made in isolation (e.g. patching `.eslintrc.js` to work around a dependency's breaking change) is invisible to the next person — or the next AI session — unless the reasoning is written down somewhere durable. Tribal knowledge held only in chat history doesn't survive a context reset.

### Decision

When a fix changes _why_ something is configured a certain way — not just _that_ it works — the corresponding doc is updated in the same change, not deferred. The `eslint-plugin-security` flat-config incompatibility is the concrete example from this session: the fix went into `.eslintrc.js`, and the explanation went into A4 (both language versions) in the same pass, including the forward-looking note on when to revisit it (flat-config migration).

- Anyone reading A4 later sees both the rule and the reason it's implemented unusually, instead of finding an unexplained inline comment in config and wondering if it's load-bearing or vestigial.
- This is the same discipline asked of human contributors via the PR checklist's "Relevant docs updated (if applicable)" — AI-authored changes follow the same rule, not a relaxed one.

---

## Decision 5 · Bilingual docs are generated, not maintained by hand in two places

### Context

This project serves a Mexican engineering team. Maintaining `docs/A*.md` in English and `docs/A*.md` (Spanish) by hand, by two different authors, risks drift — one version gets updated, the other doesn't.

### Decision

Spanish versions are full translations generated from the English source in a single pass, including code comments, table content, and diagrams — code itself stays in English since that's the language the codebase and tooling use. This file (A6) follows the same convention: English here, Spanish as `A6 · Ciclo de Vida de Desarrollo Asistido por IA.md`.

This is a known trade-off: a generated translation can drift from a hand-maintained one in tone, and there's no automated check that the two stay in sync after future edits. The mitigation is procedural, not technical — when one language version changes, regenerate the other in the same PR, the same way a config fix and its doc update travel together (Decision 4).

---

# The Framework · operationalizing the lifecycle

Everything above is **descriptive** — what was actually done this session. This section is **prescriptive**: the repeatable framework those habits hardened into, so the next feature isn't built on improvisation. The governing idea is **context engineering**. The quality ceiling of any AI output is set by what's in its context window, so instead of one agent holding the whole task (the vibe-coding failure mode — inconsistent, unauditable), the work is broken into phases, each run by a **fresh agent that reads only its inputs, produces one handoff document, and exits**. The human (or a thin orchestrator) only ever shuttles small documents between phases, so no context window ever overflows. Consistency comes from the contracts between phases, not from any single agent being clever.

## The pipeline

```
0. SPEC      → requirements ledger (R-ids)            human writes / approves
1. RESEARCH  → file map + constraints, every claim cited   researcher (read-only)
2. PLAN      → change list, each change citing R-ids   planner          ◀ KEY HUMAN GATE
3. IMPLEMENT → code + report tracing changes to R-ids  implementer
4. VERIFY    → coverage matrix + tooling gate          verifier (independent)
                                                          │
                          ┌───────────────────────────────┘
                          ▼  on failure: loop back to PLAN (wrong approach)
                                              or IMPLEMENT (wrong code)
```

Each phase writes one document into `docs/work/<feature>/`, numbered `00`–`04`. Those documents are the interface between phases and the permanent trace of the work — see `docs/work/README.md`.

## Traceability is the spine

The spec is decomposed into a **requirements ledger**: atomic, testable items with stable IDs (`R1`, `R2`, …). Every downstream artifact references those IDs, which makes "only make changes we can trace to a requirement" mechanically checkable rather than aspirational:

```
ledger      defines R1, R2, R3 …
research    maps each relevant file → the R-ids it touches
plan        every planned change cites R-ids        (orphan change = scope creep)
impl report every change traces to R-id + plan step
verify      coverage matrix:  every R has ≥1 change  → no gaps
                              every change has ≥1 R  → no gold-plating
```

That coverage matrix is the objective definition of "done and nothing extra." A `must` requirement with no change is a gap; a change with no requirement is scope creep. Both fail the gate.

## Gates and the autonomy dial

Because every handoff is a committed file, **human weigh-in is just "edit the file between phases"** — the next phase reads the artifact and doesn't care whether an agent or a human (or both) authored it. This makes adoption gradual: the same pipeline runs with as much or as little human involvement as you want, set per run as a gate policy.

| Mode                     | Behaviour                                                                        |
| ------------------------ | -------------------------------------------------------------------------------- |
| **full-control**         | Orchestrator pauses at every gate, shows the artifact, waits for approval/edits. |
| **balanced** _(default)_ | Auto through research; **checkpoint at PLAN**; auto through verify.              |
| **full-auto**            | Runs end-to-end, stopping only on the two hard rules below.                      |

**Two hard stops override every mode** — even full-auto pauses for these:

1. **Ambiguity escalation** — research or plan surfaces a spec gap → stop and ask a human; never guess.
2. **Verification failure** — coverage gap/orphan, or `tsc`/`eslint`/`jest` fails → stop and loop back.

The PLAN gate is the default checkpoint on purpose: a flawed plan costs a paragraph to fix, flawed code costs a rewrite. It's the highest-leverage place for a human to spend attention.

## Anti-hallucination: the citation rule

Agents go off-rails when they assert things about the codebase from memory. Two mechanisms prevent it:

- **The Map** (`docs/MAP.md`) — a static "how is X done here" index the researcher starts from, so it navigates to real entry points instead of inventing them.
- **Mandatory citations** — every factual claim in a research or plan doc carries a `path:line`. This is enforced in three layers, cheapest first: (1) the templates make the citation a **required field**, so its absence is a structural error, not a judgment call; (2) a validator script checks each `path:line` **exists and is in range**, killing fabricated paths mechanically; (3) the verifier **spot-checks** a sample for relevance — the path is real _and_ says what the doc claims.

This is the same philosophy as Decision 3's verification gate: replace "looks grounded" with "the structure required a source and a tool confirmed it resolves."

## The tooling, in three tiers

The framework splits cleanly into a portable core and a thin tool-specific shell, so switching AI tools later keeps the bulk of it:

| Tier                      | What                                                                                                                                                        | Where                                  | Portable?               |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ----------------------- |
| **Contracts**             | Requirements-ledger + four handoff templates; the Map                                                                                                       | `docs/work/_templates/`, `docs/MAP.md` | ✅ plain markdown       |
| **Operators**             | One subagent per phase role (researcher, planner, implementer, verifier)                                                                                    | `.claude/agents/`                      | ⚙️ Claude-Code-specific |
| **Conductor + enforcers** | Orchestrator command (drives phases, applies gate policy, reports to the human), per-phase commands for takeover, the citation + coverage validator scripts | `.claude/commands/`, `scripts/`        | ⚙️ shell-specific       |

The **contracts are the framework**; the operators and conductor just move them through the pipeline. Operators are **subagents** specifically because a subagent runs in isolated context — that isolation is the "fresh agent per phase" property the whole design depends on; a skill running in the main thread would defeat it. The **orchestrator runs in the main conversation** so that "reports back to the human" is automatic — the main thread is the only thing that talks to the user; it dispatches phase subagents, applies the gate policy, and surfaces a short summary plus the artifact between each phase.

### Running it

```
/aidlc-spec <feature-id> [source-spec]   →  scaffold + draft the ledger (human approves)
/aidlc-run  <feature-id> [mode]          →  orchestrate all four phases at a gate policy
```

For gradual adoption or human takeover, the per-phase commands run one phase at a time:
`/aidlc-research`, `/aidlc-plan`, `/aidlc-implement`, `/aidlc-verify` — each takes the feature id. Because every handoff is a file, you can run a phase, edit its artifact on disk, and hand back to the next command; the next phase reads the file and doesn't care who authored it. The enforcer scripts (`scripts/aidlc/validate-citations.mjs`, `scripts/aidlc/check-coverage.mjs`; also `pnpm aidlc:cite` / `pnpm aidlc:coverage`) back the citation and coverage gates mechanically.

> Status: all three tiers are in place — contracts (`docs/work/_templates/`, `docs/MAP.md`), operators (`.claude/agents/`), and conductor + enforcers (`.claude/commands/`, `scripts/aidlc/`). The pipeline can also be run entirely by hand: copying the templates and invoking each phase manually follows the exact same contract.

---

## What this document is not

It is not a claim that AI output requires no review — Decision 3 and Decision 4 exist precisely because it does. It's not a process the team is required to adopt going forward unmodified; it's a record of what was actually done here, so it can be evaluated, kept, or changed deliberately rather than assumed.
