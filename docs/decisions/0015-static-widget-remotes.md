# 0015 — Widgets are loaded as static remotes; runtime discovery waits for iteration 09

- Status: accepted
- Date: 2026-10-29
- Iteration: 10

## Context
The ROADMAP scope of iteration 10 says the dashboard loads widgets with `loadRemote` from iteration 09 and that no
widget URL appears in dashboard code. Iteration 09 was deferred (see PROGRESS, 2026-10-29): it exists on the branch
`feat/iteration-09-resilience` and was judged over-engineered, so `main` still uses static `remotes` everywhere.
Iteration 10 therefore had to choose how its widgets load before the loader it was designed around exists.

## Options
1. **Static `remotes` in the dashboard's webpack config** — the same mechanism as every other host in the repo, no
   new runtime code, the nesting of share scopes is the only new thing to learn. − The API registry can list a widget
   the build cannot import; the per-widget timeout of the ROADMAP is not achievable. Two acceptance criteria are
   not met.
2. **A minimal `loadRemote` written inside iteration 10** — all three criteria met, roughly 100 lines instead of
   the ~380 of the branch. − It re-opens a decision the user deliberately postponed, and the iteration's own topic
   (nested federation, widget contracts, isolation) competes for attention with script injection and share-scope
   bootstrapping.
3. **Merge the iteration 09 branch first** — the designed foundation, criteria met. − Brings back exactly the code
   that was judged over-engineered, and reorders the backlog without a decision to do so.

## Decision
Option 1, chosen by the user. The dashboard declares its three widgets as static `remotes`
(`widget_sales@http://localhost:3011/remoteEntry.js`, …) and `src/widgets/widget-modules.ts` binds each registry id
to an import specifier. The API registry (`GET /widgets`) is built and used in full — it decides which widgets are
rendered, in which order, and is the only source of a widget's `scope` and `url` — but in this iteration those two
fields are informational: webpack resolves the import against its own `remotes` list.

Consequences for the acceptance criteria are recorded, not weakened:

| Criterion | Status |
|---|---|
| Adding a registry entry (no dashboard rebuild) shows a new widget | **not met** — it renders a card saying this build does not know the widget |
| One failing widget does not affect others | met |
| Single React instance across shell → dashboard → widget | met |

The ROADMAP's per-widget timeout is likewise **not met** and was deliberately not faked: with a static remote,
webpack owns the script injection and caches the rejection of a failed `remoteEntry.js`, so a `Promise.race` timeout
would show a fallback that no retry could recover from. A timeout belongs with the loader that owns the script tag.

## Consequences
- Deploying a new widget means a dashboard rebuild, which is the exact coupling micro-frontends exist to remove.
  The dashboard shows it honestly instead of hiding it: an unknown registry id renders an "unknown widget" card
  through the same error boundary as a crash.
- Everything around the loading itself — the registry, the layout API, the widget contract, the per-widget
  boundaries, the shared share scope — is built to work with a runtime loader. Revisiting iteration 09 replaces
  `widget-modules.ts` and the `remotes` block, and nothing else.
- SPEC section 9 ("Remote URLs: static in shell config until iter 9, then runtime `remotes.json` / API registry")
  stays the plan; iteration 10 does not fulfil the second half of it.
- The branch `feat/iteration-09-resilience` carries an ADR numbered 0014, which this iteration has now used. If that
  branch is revisited, its ADR is renumbered to the next free number.
