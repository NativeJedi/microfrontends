# 0001 — Webpack 5 with classic Module Federation

- Status: accepted
- Date: 2026-10-14
- Iteration: 00

## Context
The project exists to learn how Module Federation (MF) works and to explain it in interviews.

## Options
1. **Webpack 5 + classic `ModuleFederationPlugin`** — the original implementation, most common in
   existing production codebases and interview questions; forces hand-written dynamic loading,
   typing and error handling, which exposes the internals. Cons: fewer built-in tools.
2. **Rsbuild/Rspack + Module Federation 2.0** — faster builds, dts plugin, manifest, runtime plugins,
   devtools. Cons: hides internals behind the runtime.
3. **Vite + `@module-federation/vite`** — less mature, different mental model.

## Decision
Option 1. MF 2.0 is covered as a final bonus migration (iteration 16) to compare both.

## Consequences
- Types, dynamic remotes, error handling and remote overrides are built by hand (iterations 2, 9, 13).
- No `@module-federation/*` packages before iteration 16, except the iteration 2 prototype.
