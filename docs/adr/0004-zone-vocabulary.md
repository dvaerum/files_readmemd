# ADR-0004: Zone vocabulary

Status: Accepted.

## Context

Zone identity crosses PHP, Vue, storage and CI as four different spellings.
`fileNamesForZone()` currently treats every value other than `footermd` as a
header, so an unknown zone would silently render in the header.

## Decision

Keep the current spellings during migration: `header` / `footer` for admin
actions, `headermd` / `footermd` for DOM classes and view props, and
`fileslist_header` / `fileslist_footer` for stored config. Phase 3 introduces one
declaration that maps these spellings and replaces the binary fallback with an
exhaustive lookup that fails on an unknown zone.

## Consequences

- Stored configuration keys and DOM classes must not change in Phase 3.
- Adding a zone requires a new declaration plus rendering code, not four edits.
