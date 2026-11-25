/**
 * @license AGPL-3.0-or-later
 *
 * This program is free software: you can redistribute it and/or modify it under
 * the terms of the GNU Affero General Public License as published by the Free
 * Software Foundation, either version 3 of the License, or (at your option)
 * any later version.
 *
 * Public-share adapter. Older shares expose OCA.Sharing.PublicApp.fileList;
 * newer shares expose a Vue file list with data-cy rows and no sharing globals.
 * Both shapes are read here so the mount module and the view never touch a
 * Nextcloud global or a hard-coded DOM version.
 */

import { generateUrl } from '@nextcloud/router'

const POLL_MS = 1000
const ROW_SELECTOR = 'tr[data-cy-files-list-row][data-cy-files-list-row-name]'

/**
 * @return {object|null} legacy public file list, if this share has one
 */
function legacyFileList() {
	const sharing = globalThis.OCA && globalThis.OCA.Sharing
	return sharing && sharing.PublicApp ? sharing.PublicApp.fileList : null
}

/**
 * @return {Element[]} visible file-list rows on a Vue-based share
 */
function rows() {
	return Array.from(document.querySelectorAll(ROW_SELECTOR))
}

/**
 * @return {string} share token, from the legacy input or the share URL
 */
function shareToken() {
	const input = document.getElementById('sharingToken')
	if (input && input.value) {
		return input.value
	}
	const match = globalThis.location.pathname.match(/\/s\/([^/?#]+)/)
	return match ? decodeURIComponent(match[1]) : ''
}

/**
 * @return {string} current share directory
 */
function currentPath() {
	const list = legacyFileList()
	if (list && list._currentDirectory !== undefined) {
		return list._currentDirectory
	}
	const dir = new URLSearchParams(globalThis.location.search).get('dir')
	return dir || ''
}

/**
 * @return {boolean} whether either file-list shape has rendered
 */
function isReady() {
	const list = legacyFileList()
	if (list && Array.isArray(list.files)) {
		return true
	}
	return rows().length > 0
}

/**
 * @param {Function} predicate readiness check
 * @return {Promise<void>} resolves once the check passes
 */
function waitUntil(predicate) {
	if (predicate()) {
		return Promise.resolve()
	}
	return new Promise(resolve => {
		const interval = setInterval(() => {
			if (predicate()) {
				clearInterval(interval)
				resolve()
			}
		}, POLL_MS)
	})
}

/**
 * @return {object} file-list adapter for the current public share
 */
export function createPublicAdapter() {
	return {
		mode: 'public',

		whenReady: () => waitUntil(isReady),

		currentPath,

		/**
		 * @return {Promise<string[]>} file names in the current share directory
		 */
		directoryNames: async () => {
			const list = legacyFileList()
			if (list && Array.isArray(list.files)) {
				return list.files
					.filter((file) => file.type === 'file')
					.map((file) => file.name)
			}
			return rows()
				.filter((row) => !row.querySelector('.folder-icon'))
				.map((row) => row.getAttribute('data-cy-files-list-row-name'))
				.filter(Boolean)
		},

		/**
		 * @param {string} fileName elected file
		 * @param {string} path directory path
		 * @return {string} download URL
		 */
		downloadUrl: (fileName, path) => {
			return generateUrl('/s/{token}/download?path={path}&files={file}', {
				token: shareToken(),
				path,
				file: fileName,
			})
		},

		/**
		 * Resolve a relative Markdown link exactly as the public bundle did.
		 *
		 * @param {string} link link from the rendered Markdown
		 * @param {string} path directory path
		 * @return {string} download URL
		 */
		linkUrl: (link, path) => {
			return generateUrl('/s/{token}/download?path={path}&files={file}', {
				token: shareToken(),
				path,
				file: link,
			})
		},

		/** @param {object} definition zone definition */
		mountPoint: (definition) => {
			const legacyHeader = document.querySelector('.filelist-header')
			const legacyFooter = document.querySelector('.filelist-footer')
			if (legacyHeader || legacyFooter) {
				return {
					parent: definition.adminToken === 'header' ? legacyHeader : legacyFooter,
					position: 'append',
					existing: document.querySelector('.' + definition.domClass),
				}
			}

			// Vue shares put the header and list side by side in #app-content-vue;
			// inserting after each one keeps the zones above and below the rows.
			const header = document.querySelector('.files-list__header')
			const list = document.querySelector('[data-cy-files-list], .files-list')
			const fallback = document.querySelector('#app-content-vue, #content-vue, main') || document.body
			const parent = definition.adminToken === 'header'
				? (header || fallback)
				: (list || fallback)
			return {
				parent,
				position: parent === document.body ? 'append' : 'after',
				existing: document.querySelector('.' + definition.domClass),
			}
		},

		/** @return {Element|null} container whose footer table needs adjusting */
		footerContainer: () => {
			const legacy = document.querySelector('.filelist-header, .filelist-footer')
			return legacy
				? document.querySelector('#files-public-content > #preview')
				: document.querySelector('.files-list')
		},

		/**
		 * @param {Function} callback path change listener
		 * @return {Function} unsubscribe
		 */
		onPathChange: (callback) => {
			let current = currentPath()
			const interval = setInterval(() => {
				const next = currentPath()
				if (next !== current) {
					current = next
					callback(next)
				}
			}, POLL_MS)
			return () => clearInterval(interval)
		},
	}
}
