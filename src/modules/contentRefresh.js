/**
 * @license AGPL-3.0-or-later
 *
 * This program is free software: you can redistribute it and/or modify it under
 * the terms of the GNU Affero General Public License as published by the Free
 * Software Foundation, either version 3 of the License, or (at your option)
 * any later version.
 *
 * Files calls a header's render once at startup and updated() again once the
 * real folder is known. Both paths can be in flight at once. This module owns
 * that refresh policy so only the newest path may publish a result.
 */

import { electForZone } from './fileElection.js'

/**
 * @param {object} options refresh dependencies
 * @param {string} options.zone canonical zone id
 * @param {object} options.config app config snapshot
 * @param {object} options.adapter file-list adapter with names and download URLs
 * @param {Function} options.load loads content from a URL
 * @param {Function} options.onResult receives (election, content)
 * @return {Function} refresh(path) for the current directory
 */
export function createContentRefresh({ zone, config, adapter, load, onResult }) {
	let generation = 0

	return async (path) => {
		const token = ++generation
		const directoryNames = await adapter.directoryNames(path)
		if (token !== generation) {
			return
		}

		const election = electForZone({ zone, config, directoryNames })
		if (election === null) {
			onResult(null, null)
			return
		}

		const content = await load(adapter.downloadUrl(election.fileName, path))
		if (token !== generation) {
			return
		}
		onResult(election, content)
	}
}
