# ADR-0005: Support range and negative control

Status: Accepted (Phase 7 of `docs/improvements-plan.md`).

## Context

`appinfo/info.xml` declares `min-version="28" max-version="29"`. The full visual
matrix runs on NC 29; the compatibility profile currently asserts the app is
**not** enabled on NC 33/34/35; the negative control checks out `BASE_SHA` with
the same support range and expects NC 35 to reject it. That compares the app
with itself and does not prove a patched app works where an unpatched one fails.

Nextcloud's app dependency analyzer reads a single `<nextcloud>` element
(`DependencyAnalyzer::analyzeOC()`), so disjoint ranges cannot be declared. A
range that includes 33–35 from a minimum of 28 also includes 30–32; those
versions are declared compatible but are not part of the visual matrix.

## Decision

Extend support. `appinfo/info.xml` declares `min-version="28" max-version="35"`,
and the app must render on NC 29, 33, 34 and 35. The boot hook and both CI
profiles derive their enable/expectation decision from that file through one
shared parser (`ci/lib/support-range.sh`); no version threshold is hard-coded
in the hook or `ci/run.sh`.

The negative control keeps `BASE_SHA=c31d8a243678b4f04348c40fca1e5a8e587a05aa`.
Its own `info.xml` still ends at 29, so NC 35 must reject it. The positive
profile and the control therefore differ in source and in outcome.

## Consequences

- New `ci/baselines/<version>/default/` screenshots are added for 33/34/35 and
  reviewed as code. The old `compat` baselines are replaced by those real
  renders; the `negative` baseline stays the stock-UI control.
- The 30–32 range is declared but unverified; the README states which versions
  are covered by the visual matrix.
- A shell test fails if the hook, `ci/run.sh` or the docs disagree with the
  declared range.
