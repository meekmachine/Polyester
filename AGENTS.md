# Agent Instructions

## Refactor Goal

Polyester is intended to become the ClojureScript-first runtime package for the
Character Loom agency system. Do not describe the migration as complete just
because a CLJS namespace exists. Always distinguish:

- CLJS planner/reducer code under `src-cljs/`
- JS runtime and host callback glue
- worker command/output dispatch
- inherited TypeScript compatibility services under `src/`
- LoomLarge integration and Effect-backed app/profile state

The desired architecture is data-first:

- agencies emit serializable output maps
- host/browser/Loom3/backend effects stay outside CLJS planner state
- runtime outputs become observable streams at the JS boundary
- LoomLarge bridges those streams into Effect-managed state

## Documentation Discipline

When implementation work exposes a recurring misunderstanding, missing
instruction, or architecture gap, update repo documentation in the same PR when
reasonable. Prefer:

- this `AGENTS.md` for contributor/agent workflow guidance
- `docs/` for durable architecture notes
- `README.md` for package-level entry points and status

If a user asks for detailed comments after PRs are merged, create a follow-up PR
with durable documentation instead of relying only on comments on closed PRs.

## Dependency And Deployment Claims

Before claiming LoomLarge production or previews will pick up Polyester changes,
inspect the actual committed dependency spec and lockfile. A full Git SHA pin
does not move when Polyester `main` moves. A LoomLarge PR is needed to bump the
pin unless CI is explicitly resolving a linked Polyester PR for a preview.

## Stream And State Guidance

Do not introduce new agency-local RxJS or Most streams inside CLJS planner code.
Keep CLJS outputs as plain data. If stream observability is needed, add it at the
JS runtime boundary over the ordered output stream.

Effect state should be treated as a LoomLarge integration boundary, not as
mutable state inside Polyester CLJS agencies. Polyester should provide clean
streams and snapshots for LoomLarge to consume.

## Mixer Boundary

Do not add a CLJS runtime shaped like `tick`, `STEP`, `update(delta)`,
`requestAnimationFrame`, or interval-based curve sampling. Polyester CLJS should
emit scheduled snippets and control effects. Loom3/Three owns
`AnimationMixer.update(delta)`, clip action timing, stream events, and runtime
cleanup.

When touching CLJS animation/gaze/blink/prosodic/lipsync/vocal code, run
`npm run test:cljs` so the mixer-boundary guard and smoke tests both execute.

## GitHub CLI Fallbacks

If `gh pr edit` fails because GitHub's GraphQL response includes deprecated
classic project fields, use the REST API fallback instead, for example
`gh api repos/<owner>/<repo>/pulls/<number> -X PATCH -f body="$body"`.

When passing Markdown with backticks to `gh issue comment`, `gh pr create`, or
`gh pr edit`, use `--body-file -` with a single-quoted heredoc or assign the
body from `cat <<'EOF'`. Do not put Markdown backticks inside a double-quoted
shell argument because the shell will execute them as command substitutions.

## PR Scope

For the CLJS transition, prefer small PRs that make one architectural boundary
clearer:

- an agency reducer/policy improvement
- a worker/runtime parity improvement
- a stream/output adapter improvement
- a documentation update that explains current state and next steps

When touching both CLJS and TypeScript compatibility surfaces, explicitly state
which runtime is affected.
