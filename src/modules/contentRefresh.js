/**
 * @license AGPL-3.0-or-later
 *
 * This program is free software: you can redistribute it and/or modify it under
 * the terms of the GNU Affero General Public License as published by the Free
 * Software Foundation, either version 3 of the License, or (at your option)
 * any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * Files calls a header's render once at startup and updated() again once the
 * real folder is known. Both paths can be in flight at once. This module owns
 * that refresh policy so only the newest path may publish a result, including
 * a failure.
 */

import { electForZone } from './fileElection.js'

/**
 * @param {object} options refresh dependencies
 * @param {string} options.zone canonical zone id
 * @param {object} options.config normalized app config
 * @param {object} options.adapter file-list adapter with names and download URLs
 * @param {Function} options.load loads content from a URL
 * @param {Function} options.onResult receives (election, content)
 * @param {object} options.logger injected logger for phase/Zone/path attribution
 * @return {Function} refresh(path) for the current directory
 */
export function createContentRefresh({ zone, config, adapter, load, onResult, logger }) {
	let generation = 0

	/**
	 * Publish a failure only while its refresh is still the newest path.
	 *
	 * @param {string} phase failing step
	 * @param {string} path directory path
	 * @param {number} token generation captured when the refresh started
	 * @param {unknown} error failure from the step
	 * @return {void}
	 */
	const fail = (phase, path, token, error) => {
		if (token !== generation) {
			return
		}
		logger.error('[' + zone + '] ' + phase + ' failed for path ' + path, error)
		onResult(null, null)
	}

	return async (path) => {
		const token = ++generation

		let directoryNames
		try {
			directoryNames = await adapter.directoryNames(path)
		} catch (error) {
			fail('directoryNames', path, token, error)
			return
		}
		if (token !== generation) {
			return
		}

		const election = electForZone({ zone, config, directoryNames })
		if (election === null) {
			onResult(null, null)
			return
		}

		let content
		try {
			content = await load(adapter.downloadUrl(election.fileName, path))
		} catch (error) {
			fail('load', path, token, error)
			return
		}
		if (token !== generation) {
			return
		}
		onResult(election, content)
	}
}
