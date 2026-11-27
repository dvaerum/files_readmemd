# Round 3 deepening plan

Status: decisions locked 26 November 2026; no implementation yet.

## Scope

Round 3 came from the architecture review in
`/tmp/opencode/architecture-review-20261126-075529.html`. Nine candidates were
grilled to a decision. Eight are accepted; H is explicitly not changing
anything. Every accepted change deepens a module: it narrows an interface,
concentrates an implementation, or moves a seam to where the variation lives.

Use the architecture vocabulary — module, interface, implementation, depth,
deep, shallow, seam, adapter, leverage, locality — and the domain vocabulary
from `CONTEXT.md`: README content file, Zone, Base name, Render engine, File
election, Mount, Support range.

ADRs 0001–0007 stay accepted and load-bearing. Nothing here changes the four
Zone spellings, the eight-key string wire map, File election priority, the
self-contained `ci/` harness, the Support range parser or the private/public
Mount registration split.

## Locked decisions

### A — One declaration for the Render engine set

- Add an app-root `engines.json` with PHP and JS loaders, mirroring the
  `zones.json` precedent. Do not extend `zones.json` and do not serve the
  declaration through initial state.
- The declaration carries engine id, ordered extensions, wire key and default,
  the always-on flag for markdown, and the admin control id. Translated labels,
  converter behaviour and CSS stay in the template and the Render engine
  module, keyed by the declared id.
- Engine rank is derived from declaration order. ADR-0001 File election
  priority is unchanged; there is no second rank table.
- Sync a `ci/` copy with a parity assertion. Fix the existing packaging gap by
  adding both `zones.json` and `engines.json` to the `Makefile` package target.
- Add PHP and JS loader tests for invalid, duplicate and reversed declarations,
  wire keys and defaults. Keep all File election, Render engine and decode
  outcome tests.

### B — One owner for the Base name row

- The PHP admin view owns one generic hidden `<template>` prototype for the
  row. `adminConfig.js` clones it and fills the id, `data-zone`, `data-filename`
  and text. There is no per-Zone prototype and no JS fallback markup builder.
- A missing prototype throws: drift between PHP and JS must fail loudly.
- Visible markup stays identical, so screenshot baselines stay unchanged.
- PHP pins the prototype markup; JS pins clone-and-fill behaviour; a browser
  test clicks add and delete (currently untested).

### C — Remove the third Zone validator

- Reduce `ci/tests/zones.js` to selectors over the synced declaration. Delete
  its `FIELDS` and `validate()` block.
- The PHP and JS loaders remain the only validation owners, as ADR-0004
  requires. The existing sync-function test in `ci/tests/shell/run.sh` stays.
- Add a byte-for-byte parity assertion for `zones.json` and `engines.json`
  against their `ci/` copies in the shell suite, not in Vitest.

### D — Give failure a home in Content refresh

- A failed refresh publishes `onResult(null, null)` and logs phase, Zone and
  path through an injected logger. The Zone clears rather than showing stale
  README content from a previous folder.
- The `onResult(election, content)` interface is unchanged. No outcome field,
  no second callback. Logger joins the existing dependency object.
- Failures obey the generation rule: an older failure never clears a newer
  success; a newer failure clears the older success.
- Tests cover both rejection points, both generation orderings, no unhandled
  rejection, logger attribution, and that footer layout does not run on
  failure.

### E — Move footer layout behind the Mount seam

- A standalone layout module owns the three inline DOM mutations. The view
  calls it with the existing `footerContainer()`; neither Mount adapter changes.
- Move inline mutations only. Component CSS in `RenderEngine.vue` stays, as do
  screenshot baselines.
- No reapply-on-reattach rule: `src/modules/mount.js:97-105` re-inserts the
  same container node, so its inline styles survive.

### F — Share the PHP script listener implementation

- An abstract base listener owns constructor, `handle()` and the `addScript()`
  substitution seam. Each concrete listener supplies its `SCRIPT_ASSET`.
- The two event registrations in `Application.php` stay distinct per ADR-0003.
- Keep both per-listener asset tests; add one shared call-order/wire test and a
  fake `IRegistrationContext` test for the two registrations. Add
  `Application.php` to `tests/bootstrap.php` for that test.

### G — Make CI error policy explicit and tested

- Keep `watchErrors`/`appErrors` as facades at all 16 spec call sites; add a
  pure classifier module taking messages plus page context.
- Each ignored rule records a rule id, source and observed version. Ignored
  messages are returned with the rule that matched, not silently discarded.
- Remove the exact bare-`Error` suppression; attribute the recommendation
  preview noise to a precise rule.
- Table-driven tests cover documented noise and near-miss app errors, with a
  synthetic app error as a negative control. Keep the settings and public
  share browser assertions as end-to-end proof.

### H — Decoded flags: no change

- The four decoded flags are intentionally retained wire settings with no
  frontend consumer. The `decodeConfig(wireMap) -> { engines, baseNames, flags }`
  interface from the round-2 plan stays locked and all eight wire keys stay
  live.
- No ADR was requested; future reviews should read this section before
  re-suggesting removal.

### I — Collapse the ad-hoc path encoders

- Relative Markdown links keep URL semantics: `linkUrl()` does not encode a
  legitimate query or fragment.
- A Base name may contain reserved URL characters. One shared pure encoder
  owns URL-safe path segments and is used by `adminConfig.js` and the private
  Mount adapter. Public Share stays as-is; its `generateUrl` escaping is pinned
  by tests.
- Encode per segment, never whole paths — directory separators must survive.
- Add pure encoder tests, mount and admin URL tests with multiple reserved
  characters, and a PHP controller round-trip test. No browser fixture with a
  reserved-character Base name; screenshots stay unchanged.

## Phases and gates

Each phase is one commit. Run its gate before starting the next phase; do not
queue commits that leave a half-applied state.

| Phase | Candidates | Work | Gate |
| --- | --- | --- | --- |
| 1 | A + C | Declaration, loaders, `ci/` copy, parity, packaging, selector-only CI validator | PHP + JS loader tests; declaration parity; existing File election, Render engine, Zone loader and shell suites |
| 2 | B | PHP row prototype, JS clone, e2e add/delete | PHP view test; JS binding test; settings browser test; screenshots unchanged |
| 3 | D + E | Failure ownership and footer layout module | Content refresh tests (both rejection points and generation orderings); layout jsdom tests; Mount adapter suites unchanged |
| 4 | F | Abstract listener base and registration test | PHPUnit listener and registration tests; both bundles unchanged |
| 5 | G | Pure error classifier, explicit rules, tests | Classifier table tests; settings and public share browser assertions |
| 6 | I | Shared segment encoder, PHP round-trip | Pure encoder, mount, admin and PHP controller tests; public adapter tests |

Final gate after phase 6: full Vitest suite, full PHPUnit suite,
`scripts/dev.sh verify`, lint, stylelint, build, `scripts/ci.sh shell-test`,
`scripts/ci.sh all` (including the NC 35 negative control), and browser
verification through the real CI harness. Push only to the `dvaerum` fork;
never to upstream. `BASE_SHA` stays
`c31d8a243678b4f04348c40fca1e5a8e587a05aa`.

## Non-goals

- No change to ADRs 0001–0007; no ADR-0008.
- No decoded-flag changes.
- No visual baseline changes.
- No upstream push.
