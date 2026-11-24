# ADR-0003: Private and public mounts

Status: Accepted.

## Context

`src/main.js` registers a Files `Header` and receives the current folder from
Nextcloud. `src/public.js` waits for `OCA.Sharing.PublicApp.fileList.files` and
reads the share token from the DOM. Both mount the same `Readmemd.vue`, which
currently detects mode from `#isPublic` and builds different download URLs.

## Decision

Keep two adapters at one mount seam: private Files uses header registration and
`fileTableView.getContents()`, public shares use readiness polling and
`OCA.Sharing.PublicApp.fileList`. The difference stays inside the adapters;
Phase 5 removes the mode flag from the view rather than deleting either path.

## Consequences

- Public shares need a polling adapter; replacing it with header registration
  would change observable readiness behaviour.
- Nextcloud globals belong in the adapters, not in the view or election module.
