/**
 * @license AGPL-3.0-or-later
 *
 * One WebDAV seam for both mounts. `@nextcloud/files/dav` supplies the client,
 * the user/share root and the remote URL; public shares resolve to
 * `public.php/dav/files/{token}` without any URL construction here.
 */

import * as davApi from '@nextcloud/files/dav'
import { encodePath, encodePathSegment } from './pathSegment.js'

/**
 * @param {object} [overrides] injected WebDAV dependencies for tests
 * @param {object} [overrides.client] WebDAV client
 * @param {string} [overrides.root] DAV root path
 * @param {string} [overrides.remote] DAV remote URL
 * @return {object} directory listing, content loading and link resolution
 */
export function createDav(overrides = {}) {
	const client = overrides.client ?? davApi.getClient()
	const root = overrides.root ?? davApi.getRootPath()
	const remote = overrides.remote ?? davApi.getRemoteURL()

	/**
	 * @param {string} path directory path
	 * @param {string} [fileName] optional file inside that directory
	 * @return {string} encoded DAV path below the root
	 */
	const davPath = (path, fileName) => root + encodePath(path)
		+ (fileName ? '/' + encodePathSegment(fileName.replace(/^\/+/, '')) : '')

	return {
		/** @return {string} DAV root for attribution in tests */
		root,

		/**
		 * @param {string} path directory path
		 * @return {Promise<string[]>} file names in that directory
		 */
		directoryNames: async (path) => {
			const entries = await client.getDirectoryContents(davPath(path))
			return entries
				.filter((entry) => entry.type === 'file')
				.map((entry) => entry.basename)
		},

		/**
		 * @param {string} fileName elected file
		 * @param {string} path directory path
		 * @return {Promise<string>} decoded content file
		 */
		loadContent: async (fileName, path) => client.getFileContents(
			davPath(path, fileName),
			{ format: 'text' },
		),

		/**
		 * @param {string} link link from rendered Markdown
		 * @param {string} path directory path
		 * @return {string} absolute URL for the linked file
		 */
		linkUrl: (link, path) => {
			const dir = link.startsWith('/') ? '' : path
			return remote + davPath(dir, link)
		},
	}
}
