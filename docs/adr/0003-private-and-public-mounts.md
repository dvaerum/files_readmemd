# ADR-0003: Private and public mounts

Status: Accepted.

## Context

`src/main.js` registers a Files `Header` and receives the current folder;
`src/public.js` waits for `OCA.Sharing.PublicApp.fileList`. Both must mount the
same two zones, but they had separate polling, node placement and folder-view
loops, and the view detected mode from `#isPublic` to build download URLs.

## Decision

One `createMount()` owns node creation, placement and the Vue lifecycle. Two
adapters satisfy its seam: private Files wraps the header's folder view and
`OC.linkToRemoteBase`; public shares own readiness/path polling and the share
download URL. Adapters also expose `mode`, Markdown `linkUrl()` and
`footerContainer()` so engine components can keep their existing link and theme
behaviour without reading globals. The view receives `fileListAdapter`, asks it
for names and a download URL, and never branches on mode.

Registration differs by necessity: `main.js` creates one private adapter per
header render (the slot and view change), destroys the previous mounts, and
calls `update()` from `Header.updated`; `public.js` creates one adapter, awaits
`whenReady()`, then mounts both zones.

## Consequences

- Public shares keep their polling adapter; header registration would change
  observable readiness behaviour.
- Nextcloud globals live in adapters. The view reads no `OCA`, `OC`,
  `#sharingToken`, `#isPublic` or download URL construction, and engine
  components receive the adapter instead of a mode flag.
- A fake third adapter can test the mount lifecycle without Nextcloud.
