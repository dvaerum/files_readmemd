/**
 * @license AGPL-3.0-or-later
 *
 * Files calls a header's render once with '/' and updated() again once the
 * real folder is known. Both paths can be in flight at once. This module owns
 * that refresh policy so only the newest path may publish a result, including
 * a failure, and exposes the failure to the Zone so it can render an error.
 */

import { electForZone } from './fileElection.js'

/**
 * @param {object} options refresh dependencies
 * @param {string} options.zone canonical zone id
 * @param {object} options.config normalized app config
 * @param {object} options.adapter file-list adapter with names and content
 * @param {Function} options.onResult receives (election, content, error)
 * @param {object} options.logger injected logger for phase/Zone/path attribution
 * @return {Function} refresh(path) for the current directory
 */
export function createContentRefresh({ zone, config, adapter, onResult, logger }) {
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
		onResult(null, null, error)
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
			onResult(null, null, null)
			return
		}

		let content
		try {
			content = await adapter.loadContent(election.fileName, path)
		} catch (error) {
			fail('loadContent', path, token, error)
			return
		}
		if (token !== generation) {
			return
		}
		onResult(election, content, null)
	}
}
