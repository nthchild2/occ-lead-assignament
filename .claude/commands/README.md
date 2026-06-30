# `.claude/commands/` — AIDLC conductor (tier 3)

Slash commands that drive the AI-Assisted Development Lifecycle (see [`docs/A6`](<../../docs/A6 · AI-Assisted Development Lifecycle.md>) → "The Framework"). These run in the **main conversation**, which is what makes "report back to the human" automatic — the main thread is the only thing that talks to the user. They dispatch the tier-2 operator subagents (`.claude/agents/`) and run the tier-3 enforcer scripts (`scripts/aidlc/`).

| Command                  | Phase    | What it does                                                                                                                                                   |
| ------------------------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/aidlc-spec <id> [src]` | 0 · SPEC | Scaffold `docs/work/<id>/` and draft the requirements ledger from a source spec. Stops at the human sign-off gate.                                             |
| `/aidlc-run <id> [mode]` | all      | **Orchestrator.** Drives all four phases under a gate policy (`full-control` / `balanced` / `full-auto`), applies the two hard stops, loops on verify failure. |
| `/aidlc-research <id>`   | 1        | Run the researcher + citation validator.                                                                                                                       |
| `/aidlc-plan <id>`       | 2        | Run the planner + citation validator (the key human gate).                                                                                                     |
| `/aidlc-implement <id>`  | 3        | Run the implementer on an approved plan.                                                                                                                       |
| `/aidlc-verify <id>`     | 4        | Run the coverage checker + independent verifier (tooling gate).                                                                                                |

## Two ways to drive the pipeline

- **Orchestrated** — `/aidlc-run <id>` runs end-to-end at the autonomy level you pick. Default `balanced` checkpoints only at the plan gate.
- **Manual / takeover** — run the per-phase commands one at a time. This is the gradual-adoption and human-takeover path: you can run a phase yourself, edit the artifact on disk, then hand back to the next command. The next phase reads the file and doesn't care who wrote it.

## Enforcer scripts (used by the commands)

- `node scripts/aidlc/validate-citations.mjs <feature-dir>` — every `path:line` cited in research/plan resolves to a real file + in-range line. (`pnpm aidlc:cite`)
- `node scripts/aidlc/check-coverage.mjs <feature-dir>` — no gaps (every `must` covered) and no orphans (every change cites a requirement). (`pnpm aidlc:coverage`)
