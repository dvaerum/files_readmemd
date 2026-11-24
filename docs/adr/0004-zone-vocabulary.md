# ADR-0004: Zone vocabulary

Status: Accepted.

## Context

Zone identity crosses PHP, Vue, storage and CI as four different spellings.
The old `fileNamesForZone()` treated every value other than `footermd` as a
header, so an unknown zone silently rendered in the header.

## Decision

Keep the current spellings: `header` / `footer` for admin actions,
`headermd` / `footermd` for DOM classes and view props, and
`fileslist_header` / `fileslist_footer` for stored config. `zones.json` is the
single declaration that maps them. PHP and JS loaders validate it, and every
lookup is exhaustive: an unknown zone id or field value throws.

## Consequences

- Stored configuration keys and DOM classes stayed unchanged in Phase 3.
- Adding a zone requires a declaration edit plus rendering code, not four edits.
- File election receives the canonical zone id derived from the view's DOM-class
  prop; it never guesses a zone from an unknown token.
