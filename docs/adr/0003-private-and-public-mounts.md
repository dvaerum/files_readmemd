# ADR-0003: Private and public mounts

Status: Accepted (port to Nextcloud 33–35).

## Context

The previous mount used `OCA.Sharing.PublicApp.fileList`, `_currentDirectory`,
row `data-cy` scraping and a `#sharingToken`-derived download URL in public
shares, and a legacy Files header registration in private shares. Those APIs
are gone in NC 33; the view also branched on mode to build links and applied
footer layout with inline style mutations.

## Decision

One `createMount()` owns a stable `<readmemd-zone>` wrapper and its Vue 3 app.
Adapters supply the mount point, directory names, content and link URLs:

- Private Files registers a supported `Header` through
  `createHeaderDescriptor()` / `registerHeader()`. Each header render creates
  fresh adapters and mounts, and `Header.updated()` calls `mount.update(path)`.
- Public shares use `@nextcloud/sharing/public` for the token and a bounded
  readiness probe. The directory path comes from the router's `dir` query
  parameter, polled through `onPathChange()`; no sharing globals or row
  scraping are read.
- Both adapters read files and resolve links through the `@nextcloud/files/dav`
  seam. The view receives no mode flag and builds no URLs itself.
- The mount reattaches its wrapper on a path change instead of watching DOM
  mutations. Header and list anchors are found by a single named capability
  probe; the footer has no Files slot, so its layout lives in CSS.

## Consequences

- A fake adapter and a fake DAV client exercise mount, path changes and link
  encoding without a Nextcloud server.
- Files replacing a header slot between folder views is handled by reattachment
  on the next path change, not by a `MutationObserver`.
- Theme colours and the footer table layout are expressed in one stylesheet
  using Nextcloud theming custom properties, including dark mode.
