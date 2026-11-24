# ADR-0001: File election policy

Status: Accepted — characterizes the behaviour present at `c31d8a2`; changing it requires a new ADR.

## Context

A zone renders at most one README content file. Candidate names come from the
configured base names for that zone and from the enabled render engines. Both
private Files and public shares supply the directory names to the same election
loop in `src/view/Readmemd.vue`.

## Decision

Keep this policy:

- For each base name, candidates are generated as markdown visible, markdown
  hidden, asciidoc visible then hidden when enabled, html visible then hidden
  when enabled.
- The **last** candidate found in the directory wins. Expressed as a descending
  priority tuple, a winner is chosen by later configured base name, then higher
  engine rank (`html > asciidoc > markdown`), then hidden over visible, then the
  later extension in the engine's table (`md` before `markdown`, `adoc` before
  `asciidoc`, `htm` before `html`).
- Only entries reported as files participate; the adapters drop folders before
  calling the election module.
- Disabled asciidoc/html candidates are never elected.

## Consequences

- CI fixtures depend on `.README.md` winning in the root folder and `README.md`
  winning in the subfolder, where no hidden variant exists. They also cover a
  later base name beating an earlier hidden variant when extra names are set.
- `src/modules/fileElection.js` owns this policy; `Readmemd.vue` only renders its
  answer. The interface returns `{ fileName, engine, baseName, hidden, reason }`
  so logs can explain which variant won.
