# ADR-0006: Self-contained CI harness

Status: Accepted.

## Context

The Playwright harness must run both from the local checkout and from a
standalone fork of this app repository in GitHub Actions. The root workspace
contains dev scripts and fixtures that a fork will not have.

## Decision

Everything the workflow needs lives under `apps/files_readmemd/`: `ci/` holds
its own fixtures, hooks, Compose file, browser config, tests and baselines, and
`scripts/ci.sh` is only a convenience wrapper. No root-workspace file becomes a
CI dependency.

## Consequences

- Fixture and hook copies in `ci/` are deliberate, not duplication to remove.
- Consolidating with root copies requires keeping the fork self-contained.
