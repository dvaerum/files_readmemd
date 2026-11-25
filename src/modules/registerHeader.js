/**
 * @license AGPL-3.0-or-later
 *
 * This program is free software: you can redistribute it and/or modify it under
 * the terms of the GNU Affero General Public License as published by the Free
 * Software Foundation, either version 3 of the License, or (at your option)
 * any later version.
 *
 * Files header registration. Nextcloud 29 keeps headers in a window array;
 * Nextcloud 33 and later keep them in a versioned scoped Map and notify their
 * registry after mount. Register with both so one bundle works across the
 * declared support range.
 */

import { registerFileListHeaders } from '@nextcloud/files'

/**
 * @param {object} header Files header to register
 * @return {void}
 */
export function registerHeader(header) {
	registerFileListHeaders(header)

	const globals = globalThis._nc_files_scope && globalThis._nc_files_scope.v4_0
	if (!globals) {
		return
	}

	globals.fileListHeaders ??= new Map()
	globals.fileListHeaders.set(header.id, header)

	// The registry is created lazily. When it already exists, Files is mounted
	// and listens for this event to refresh its header list.
	if (globals.registry && typeof globals.registry.dispatchEvent === 'function') {
		globals.registry.dispatchEvent(new CustomEvent('register:listHeader', { detail: header }))
	}
}
