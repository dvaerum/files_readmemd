# ADR-0005: Support range and negative control

Status: Proposed — decided in Phase 7 of `docs/improvements-plan.md`.

## Context

`appinfo/info.xml` declares `min-version="28" max-version="29"`. The full visual
matrix runs on NC 29; the compatibility profile currently asserts the app is
**not** enabled on NC 33/34/35; the negative control checks out `BASE_SHA` with
the same support range and expects NC 35 to reject it. That compares the app with
itself and does not prove a patched app works where an unpatched one fails.

## Decision

Deferred. Phase 7 chooses between extending real support to NC 33/34/35 and
honestly renaming the current profile to an unsupported-version smoke test. No
compatibility claim in code or docs may change before that decision is recorded
here.

## Consequences

- The boot hook, `ci/run.sh` and docs must derive their expectations from one
  declaration once the decision is made.
- Baseline PNGs under `ci/baselines/33-apache` and above are provisional until
  then.
