# 0002 — Monorepo with pnpm workspaces + Turborepo

- Status: accepted
- Date: 2026-10-14
- Iteration: 00

## Context
Many independently built apps (shell, remotes, widgets) plus shared packages and a backend.

## Options
1. **pnpm workspaces + Turborepo** — transparent task runner, build caching, `--filter` for
   "affected only" CI; config stays explicit.
2. **Nx** — powerful, has MF generators, but generators hide Webpack/MF config, which defeats the
   learning goal.
3. **Polyrepo** — the most realistic for independent teams, but too much overhead for a demo.

## Decision
Option 1. Independent deployability is simulated by versioned deploys (iteration 13), not by
separate repos.

## Consequences
- Easy cross-package types and contracts; risk of hidden coupling — contracts rules (iteration 4)
  must be followed as if apps lived in separate repos.
- Shared dependency versions aligned with pnpm catalogs (iteration 1).
