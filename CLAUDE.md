# CLAUDE.md — Agent entry point

This repo is a **learning project**: an iterative micro-frontends demo built with
**Webpack 5 classic Module Federation (MF)**. Every iteration reproduces one real-world
micro-frontend challenge and then solves it. The goal is understanding and
interview-ready explanations, not feature completeness.

## Project documentation location

All project documentation lives in the **`docs/` folder at the repository root**
(`<repo-root>/docs/`). Every `docs/...` path in this file is relative to the repository root.
Never create documentation elsewhere (no docs inside `apps/*`, `packages/*` or `services/*`,
except a short README per package when needed).

```
docs/
├─ SPEC.md          # architecture, stack, conventions — source of truth
├─ ROADMAP.md       # iterations: goal, reproduce, scope, acceptance criteria
├─ PROGRESS.md      # session log, current iteration pointer
├─ decisions/       # ADRs: NNNN-title.md (template: 0000-template.md)
└─ notes/           # per-iteration learning notes: NN-slug.md (template: _template.md)
```

## Read before doing anything

1. `docs/SPEC.md` — architecture, stack, app map, ports, conventions. Source of truth.
2. `docs/PROGRESS.md` — read the **"Current iteration"** line and the **latest entry**.
3. `docs/ROADMAP.md` — read the overview table and **only the section of the current iteration**.
4. `docs/decisions/` — ADRs (Architecture Decision Records) referenced by the current iteration.
5. `docs/notes/` — notes of previous iterations only if the current one depends on them.

If the user names a different iteration than PROGRESS.md, follow the user, and say so.

## Working rules

- **One iteration per session.** Do not implement anything listed for a later iteration,
  even if it looks easy. If the current task truly needs it, stop and ask.
- **Reproduce first, then fix.** For every iteration with a "Reproduce" block:
  build the broken state, confirm the failure (error text, screenshot description,
  network observation), commit it, tag `iter-NN-problem`. Then implement the fix.
- **Stay inside the stack** from `docs/SPEC.md`. A new dependency or a deviation
  needs an ADR in `docs/decisions/` and a line in PROGRESS.md.
- **Explicit over magic.** No generators that hide Webpack/MF config. The learner must
  be able to read every line of `webpack.config.js`.
- **Open decisions** marked `⚠ Open decision` in ROADMAP.md: present options with
  trade-offs to the user and wait for an answer before implementing.
- Never weaken an acceptance criterion silently. If one can't be met, record why.

## Definition of done (every iteration)

- [ ] All acceptance criteria in ROADMAP.md for the iteration are met and verified
      by actually running the apps (not just by reading code).
- [ ] `pnpm build` and `pnpm typecheck` pass for the whole monorepo.
- [ ] `docs/notes/NN-slug.md` written from `docs/notes/_template.md`.
- [ ] ADR added for every non-trivial decision.
- [ ] `docs/SPEC.md` updated if the iteration changed architecture, ports, shared deps policy, or conventions.
- [ ] Iteration status updated in ROADMAP.md overview table.
- [ ] New entry on top of `docs/PROGRESS.md`, "Current iteration" line moved forward.
- [ ] Final commit, tag `iter-NN-done`.

## Git

- Branch per iteration: `iter/NN-slug` (e.g. `iter/05-state`), merged to `main` when done.
- Conventional Commits: `feat(catalog): ...`, `fix(shell): ...`, `docs: ...`, `repro(cart): ...`
  (`repro` = commit that intentionally reproduces a problem).
- Tags: `iter-NN-problem` (broken state reproduced), `iter-NN-done` (solution).

## Language

- Talk to the user in **Ukrainian**, concise and direct.
- Code, comments, docs, commit messages, notes — **English**.
- Expand abbreviations the first time they appear in notes (e.g. "SSR (Server-Side Rendering)").

## Commands

```bash
pnpm install
pnpm dev                       # all apps + api via Turborepo
pnpm dev --filter catalog...   # one app and its deps
pnpm build
pnpm typecheck
pnpm lint
```
