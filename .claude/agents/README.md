# `.claude/agents/` — AIDLC operators (tier 2)

These are the **operator subagents** for the AI-Assisted Development Lifecycle (see [`docs/A6`](<../../docs/A6 · AI-Assisted Development Lifecycle.md>) → "The Framework"). One per phase. Each runs in **isolated context** — reads only its inputs, fills one handoff document from `docs/work/_templates/`, and exits. That isolation is the whole point: it's what keeps any single agent's context window from overflowing.

| Phase         | Agent               | Reads                                                 | Writes                     | Touches code?    |
| ------------- | ------------------- | ----------------------------------------------------- | -------------------------- | ---------------- |
| 1 · RESEARCH  | `aidlc-researcher`  | `00-spec`, `MAP.md`                                   | `01-research.md`           | no (read-only)   |
| 2 · PLAN      | `aidlc-planner`     | `00-spec`, `01-research`                              | `02-plan.md`               | no               |
| 3 · IMPLEMENT | `aidlc-implementer` | `00-spec`, `02-plan`, `MAP.md`                        | code + `03-impl-report.md` | yes              |
| 4 · VERIFY    | `aidlc-verifier`    | `00-spec`, `02-plan`, `03-impl-report`, `01-research` | `04-verify.md`             | no (independent) |

## How they're invoked

The **orchestrator** (tier 3, not yet built) drives them in sequence, applying the gate policy and reporting to the human between phases. Until it exists, invoke them directly with the Task tool — pass the **feature id** so the agent knows which `docs/work/<feature>/` directory to read and write. Each agent is a thin wrapper; the contract it enforces lives in the matching template under `docs/work/_templates/`.

## Design notes

- **Subagents, not skills** — a subagent gets its own context window; a skill runs in the main thread and would defeat the per-phase isolation.
- **The researcher and verifier never touch source code.** The verifier's independence (fresh context, no fixing) is what makes its PASS/FAIL trustworthy.
- **The two hard stops live here too:** researcher/planner raise _ambiguity escalations_; the verifier enforces the _verification hard stop_. Both override any autonomy mode.
