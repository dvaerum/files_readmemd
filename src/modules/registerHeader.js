/**
 * @license AGPL-3.0-or-later
 *
 * Supported file-list header registration. Nextcloud 33 ships
 * `@nextcloud/files` 4.x with `registerFileListHeader`; there is no scoped
 * global or legacy window array to mirror here.
 */

import { registerFileListHeader } from '@nextcloud/files'

/** @return {string} canonical header id */
export const HEADER_ID = 'readmemd'

/**
 * Build the header descriptor from the mount callbacks.
 *
 * @param {object} callbacks header lifecycle callbacks
 * @param {Function} callbacks.render called with (el, folder, view)
 * @param {Function} callbacks.updated called with (folder, view)
 * @return {object} descriptor accepted by registerFileListHeader
 */
export function createHeaderDescriptor({ render, updated }) {
	return {
		id: HEADER_ID,
		order: 100,
		enabled: () => true,
		render,
		updated,
	}
}

/**
 * @param {object} header header descriptor
 * @return {void}
 */
export function registerHeader(header) {
	registerFileListHeader(header)
}
