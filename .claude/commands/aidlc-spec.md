---
description: AIDLC Phase 0 — scaffold a new feature's requirements ledger from a source spec.
argument-hint: <feature-id> [path-to-source-spec]
allowed-tools: Bash, Read, Write
---

Start a new AIDLC run for feature **`$1`** (see `docs/A6 · AI-Assisted Development Lifecycle.md` → "The Framework").

Do this:

1. Create the run directory `docs/work/$1/` if it doesn't exist.
2. Copy `docs/work/_templates/00-spec.md` to `docs/work/$1/00-spec.md`.
3. If a source spec was provided (`$2`), read it and decompose it into the requirements ledger: atomic, testable requirements with stable `R`-ids, each with a source, an acceptance criterion, and a MoSCoW priority. Fill the summary, out-of-scope, and open-questions sections. If no source was provided, fill what you can from context and leave clearly-marked TODOs.
4. Set the feature id to `$1` and today's date.

Then **stop and show the human the ledger**. The SPEC gate is always a human gate — the ledger is the contract the rest of the run is held to, so it must be reviewed and the sign-off checkbox ticked before research begins. Do not start research from this command.
