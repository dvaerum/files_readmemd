/**
 * @license AGPL-3.0-or-later
 *
 * Private Files adapter. WebDAV supplies directory names and content; the
 * supported header render callback supplies the initial path and mount element.
 * No Nextcloud global or private Files view object is read here.
 */

import { findAnchor } from '../modules/anchors.js'
import { createDav } from '../modules/dav.js'

/**
 * @param {object} layout where this zone's node belongs
 * @param {Element|Function} layout.parent parent element or a function returning it
 * @param {string} layout.position 'append' or 'after'
 * @param {object} [options] injected dependencies
 * @param {object} [options.dav] WebDAV seam
 * @param {string} [options.path] initial directory path
 * @return {object} file-list adapter
 */
export function createPrivateAdapter(layout, options = {}) {
	const access = options.dav || createDav()
	let currentPath = options.path || ''

	return {
		mode: 'private',

		whenReady: () => Promise.resolve(),

		currentPath: () => currentPath,

		/** @param {string} path new directory path */
		setPath: (path) => { currentPath = path },

		/**
		 * @param {string} path directory path
		 * @return {Promise<string[]>} file names in the directory
		 */
		directoryNames: (path) => access.directoryNames(path),

		/**
		 * @param {string} fileName elected file
		 * @param {string} path directory path
		 * @return {Promise<string>} content file
		 */
		loadContent: (fileName, path) => access.loadContent(fileName, path),

		/**
		 * @param {string} link link from rendered Markdown
		 * @param {string} path directory path
		 * @return {string} absolute URL for the link
		 */
		linkUrl: (link, path) => access.linkUrl(link, path),

		/** @param {object} definition zone definition */
		mountPoint: (definition) => ({
			parent: typeof layout.parent === 'function' ? layout.parent() : layout.parent,
			position: layout.position,
			existing: null,
		}),

		/** @return {Function} no-op unsubscribe */
		onPathChange: () => () => {},
	}
}

/**
 * Private zones do not own the supported header slot; the footer uses the one
 * named anchor probe instead.
 *
 * @param {string} zoneId canonical zone id
 * @return {object} footer layout descriptor
 */
export function privateFooterLayout(zoneId) {
	return { parent: () => findAnchor(zoneId), position: 'after' }
}
