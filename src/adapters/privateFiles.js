/**
 * @license AGPL-3.0-or-later
 *
 * This program is free software: you can redistribute it and/or modify it under
 * the terms of the GNU Affero General Public License as published by the Free
 * Software Foundation, either version 3 of the License, or (at your option)
 * any later version.
 *
 * Private Files adapter. All Nextcloud globals and the Files header's
 * folder-view shape stay here; the mount module only sees the adapter seam.
 */

/**
 * @param {object} view the Files header view supplied to Header.render()
 * @param {object} layout where this zone's node belongs
 * @param {Element|Function} layout.parent parent element or a function returning it
 * @param {string} layout.position 'append' or 'after'
 * @return {object} file-list adapter
 */
export function createPrivateAdapter(view, layout) {
	return {
		mode: 'private',

		whenReady: () => Promise.resolve(),

		currentPath: () => view.getCurrentDirectory ? view.getCurrentDirectory() : '',

		/**
		 * @param {string} path directory path
		 * @return {Promise<string[]>} file names in the directory
		 */
		directoryNames: async (path) => {
			const { contents } = await view.getContents(path)
			return contents
				.filter((file) => file.type === 'file')
				.map((file) => file.basename)
		},

		/**
		 * @param {string} fileName elected file
		 * @param {string} path directory path
		 * @return {string} download URL
		 */
		downloadUrl: (fileName, path) => {
			const dir = path.replace('?', '%3F')
			const file = fileName.replace('?', '%3F')
			return OC.linkToRemoteBase('files' + dir + '/' + file)
		},

		/**
		 * Resolve a relative Markdown link exactly as the private bundle did.
		 *
		 * @param {string} link link from the rendered Markdown
		 * @param {string} path directory path
		 * @return {string} download URL
		 */
		linkUrl: (link, path) => {
			const dir = link.startsWith('/') ? '' : path
			return OC.linkToRemoteBase('files' + dir + '/' + link)
		},

		/** @param {object} definition zone definition */
		mountPoint: (definition) => ({
			parent: typeof layout.parent === 'function' ? layout.parent() : layout.parent,
			position: layout.position,
			existing: document.querySelector('.' + definition.domClass),
		}),

		/** @return {Element|null} container whose footer table needs adjusting */
		footerContainer: () => document.querySelector('.files-list'),

		/** @return {Function} no-op unsubscribe */
		onPathChange: () => () => {},
	}
}
