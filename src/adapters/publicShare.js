/**
 * @license AGPL-3.0-or-later
 *
 * Public-share adapter. The share token comes from the supported sharing
 * package and WebDAV handles authentication through the browser session that
 * core sets when a password-protected share is unlocked. No sharing globals,
 * row scraping or download endpoint are used.
 */

import { getSharingToken, isPublicShare } from '@nextcloud/sharing/public'
import { findAnchor } from '../modules/anchors.js'
import { createDav } from '../modules/dav.js'
import { zoneForDomClass } from '../zones.js'

const READY_TIMEOUT_MS = 15000
const READY_INTERVAL_MS = 100
const PATH_INTERVAL_MS = 1000

/**
 * @return {boolean} whether the share view has produced a list to mount beside
 */
function hasShareView() {
	return Boolean(document.querySelector('.files-list__header, .files-list, .files-list__table'))
}

/**
 * @param {Function} predicate readiness check
 * @return {Promise<void>} rejects if the share view never appears
 */
function waitUntil(predicate) {
	if (predicate()) {
		return Promise.resolve()
	}
	return new Promise((resolve, reject) => {
		const started = Date.now()
		const interval = setInterval(() => {
			if (predicate()) {
				clearInterval(interval)
				resolve()
			} else if (Date.now() - started >= READY_TIMEOUT_MS) {
				clearInterval(interval)
				reject(new Error('Public share view did not become ready'))
			}
		}, READY_INTERVAL_MS)
	})
}

/**
 * @param {object} [options] injected dependencies
 * @param {object} [options.dav] WebDAV seam
 * @return {object} file-list adapter for the current public share
 */
export function createPublicAdapter(options = {}) {
	const access = options.dav || createDav()

	/**
	 * @return {string} current share directory from the router query
	 */
	const currentPath = () => new URL(globalThis.location.href).searchParams.get('dir') || ''

	return {
		mode: 'public',

		whenReady: () => waitUntil(hasShareView),

		currentPath,

		/** @return {void} public paths come from the router, not the header */
		setPath: () => {},

		/**
		 * @param {string} path directory path
		 * @return {Promise<string[]>} file names in the current share directory
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

		/** @return {string} share token from the supported sharing helper */
		token: () => isPublicShare() ? getSharingToken() : '',

		/** @param {object} definition zone definition */
		mountPoint: (definition) => ({
			parent: () => findAnchor(zoneForDomClass(definition.domClass)),
			position: 'after',
			existing: null,
		}),

		/**
		 * Nextcloud publishes node events but no directory-navigation event, so
		 * the query string is the only stable signal available here.
		 *
		 * @param {Function} callback path change listener
		 * @return {Function} unsubscribe
		 */
		onPathChange: (callback) => {
			let current = currentPath()
			const check = () => {
				const next = currentPath()
				if (next !== current) {
					current = next
					callback(next)
				}
			}
			const interval = setInterval(check, PATH_INTERVAL_MS)
			globalThis.addEventListener('popstate', check)
			return () => {
				clearInterval(interval)
				globalThis.removeEventListener('popstate', check)
			}
		},
	}
}
