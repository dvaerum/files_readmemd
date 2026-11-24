# ADR-0002: Config wire encoding

Status: Accepted.

## Context

`occ config:app:set files_readmemd <key> --type=boolean` stores `1`, which the
frontend and templates do not recognize. The app's wire map already uses the
strings `true` and `false`, and filename lists are JSON arrays. PHP, Vue and the
browser CI harness all depend on that encoding.

## Decision

Keep the wire map string-valued: six boolean-ish keys carry `true`/`false`, and
`fileslist_header` / `fileslist_footer` carry JSON arrays. Phase 2 may add typed
named queries inside the PHP config module, but the endpoint and initial state
keep emitting the same eight-key string map.

## Consequences

- CI setup must keep using plain `--value=true` / `--value=false`, never
  `--type=boolean`.
- The old frontend assets continue to work while the config module is deepened.
- A future switch to real booleans needs a new ADR and a coordinated frontend,
  template and harness change.
