# ADR-0005: Support range and negative control

Status: Accepted (port to Nextcloud 33–35).

## Context

The upstream app declared `min-version="28" max-version="29"` and relied on
integration points that Nextcloud 33 removed: `OCA.Sharing`, the old Files
header registration and script-side config reads. Declaring 28–35 while only
testing 29 and treating 33–35 as "compat" smoke checks hid those breakages.

The unpatched baseline at `BASE_SHA=c31d8a243678b4f04348c40fca1e5a8e587a05aa`
still declares 28–29. On NC 35 that range alone makes the app incompatible, so
it remains a valid negative control without patching the baseline worktree.

## Decision

`appinfo/info.xml` declares `min-version="33" max-version="35"`. The full visual
matrix runs every configuration state on NC 33, 34 and 35; the compatibility
profile keeps a default-state render check on those versions. The boot hook and
CI profiles derive their enable/expectation decision from `info.xml` through
one parser (`ci/lib/support-range.sh`); no caller hard-codes a threshold.

The negative control keeps `BASE_SHA` unchanged. NC 35 must reject the
unpatched app while the patched source renders on the same version.

## Consequences

- Baselines live under `ci/baselines/<version>/<state>/` for 33/34/35; the NC
  29 baselines are removed. They are regenerated in one deliberate commit.
- Versions 30–32 are neither declared nor tested; the README and CI docs state
  the supported range and the versions covered by the matrix.
- Shell tests fail if the hook, `ci/run.sh` or the docs disagree with the
  declared range.
