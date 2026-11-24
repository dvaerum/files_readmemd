# ADR-0001: File election policy

Status: Accepted — characterizes the behaviour present at `c31d8a2`; changing it requires a new ADR.

## Context

A zone renders at most one README content file. Candidate names come from the
configured base names for that zone and from the enabled render engines. Both
private Files and public shares supply the directory names to the same election
loop in `src/view/Readmemd.vue`.

## Decision

Keep this policy:

- For each base name, candidates are ordered: markdown visible, markdown hidden,
  asciidoc visible then hidden when enabled, html visible then hidden when enabled.
- The **last** candidate found in the directory wins. A hidden variant therefore
  beats its visible counterpart, and a later base name beats an earlier one.
- Only entries reported as files participate; folders are ignored.
- Disabled asciidoc/html candidates are never elected.

## Consequences

- CI fixtures depend on `.README.md` winning in the root folder and `README.md`
  winning in the subfolder, where no hidden variant exists.
- Phase 4 must move this policy into one module without changing the tie-break.
