/**
 * @license AGPL-3.0-or-later
 *
 * This program is free software: you can redistribute it and/or modify it under
 * the terms of the GNU Affero General Public License as published by the Free
 * Software Foundation, either version 3 of the License, or (at your option)
 * any later version.
 *
 * Public-share adapter. Readiness and later path changes are polled here so the
 * mount module and the view never touch OCA.Sharing or the share token.
 */

import { generateUrl } from '@nextcloud/router'

const POLL_MS = 1000

/**
 * @return {object} file-list adapter for the current public share
 */
export function createPublicAdapter() {
	// Read through OCA on every call: the public app may install its file list
	// after DOMContentLoaded, which is exactly what the old polling loop did.
	const fileList = () => OCA.Sharing.PublicApp.fileList

	return {
		mode: 'public',

		whenReady: () => {
			if (fileList() && fileList().files !== undefined) {
				return Promise.resolve()
			}
			return new Promise(resolve => {
				const interval = setInterval(() => {
					if (fileList() && fileList().files !== undefined) {
						clearInterval(interval)
						resolve()
					}
				}, POLL_MS)
			})
		},

		currentPath: () => fileList()._currentDirectory,

		/**
		 * @return {Promise<string[]>} file names in the current share directory
		 */
		directoryNames: async () => fileList().files
			.filter((file) => file.type === 'file')
			.map((file) => file.name),

		/**
		 * @param {string} fileName elected file
		 * @param {string} path directory path
		 * @return {string} download URL
		 */
		downloadUrl: (fileName, path) => {
			const token = document.getElementById('sharingToken').value
			return generateUrl('/s/{token}/download?path={path}&files={file}', {
				token,
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
			const token = document.getElementById('sharingToken').value
			return generateUrl('/s/{token}/download?path={path}&files={file}', {
				token,
				path,
				file: link,
			})
		},

		/** @param {object} definition zone definition */
		mountPoint: (definition) => ({
			parent: document.querySelector(definition.adminToken === 'header'
				? '.filelist-header'
				: '.filelist-footer'),
			position: 'append',
			existing: document.querySelector('.' + definition.domClass),
		}),

		/** @return {Element|null} container whose footer table needs adjusting */
		footerContainer: () => document.querySelector('#files-public-content > #preview'),

		/**
		 * @param {Function} callback path change listener
		 * @return {Function} unsubscribe
		 */
		onPathChange: (callback) => {
			let current = fileList()._currentDirectory
			const interval = setInterval(() => {
				const next = fileList()._currentDirectory
				if (next !== current) {
					current = next
					callback(next)
				}
			}, POLL_MS)
			return () => clearInterval(interval)
		},
	}
}
