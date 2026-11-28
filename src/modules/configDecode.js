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
 * One frontend decode seam for the string-valued config wire map. The wire
 * stays as ADR-0002 requires; every consumer sees normalized values instead.
 */

import { engineIds, isAlwaysOn, wireDefault, wireKey } from '../engines.js'
import { zone, zoneIds } from '../zones.js'

const LIST_DEFAULTS = {
	fileslist_header: ['HEADER'],
	fileslist_footer: ['README'],
}

const TRUE_VALUES = ['true', '1', 'on', 'yes']
const FALSE_VALUES = ['false', '0', 'off', 'no', '']

/**
 * @param {*} value raw wire value
 * @param {boolean} fallback value when the wire value is unknown
 * @return {boolean} normalized flag
 */
function parseBoolean(value, fallback) {
	if (value === undefined || value === null) {
		return fallback
	}

	const normalized = String(value).trim().toLowerCase()
	if (TRUE_VALUES.includes(normalized)) {
		return true
	}
	if (FALSE_VALUES.includes(normalized)) {
		return false
	}
	return fallback
}

/**
 * @param {*} value raw wire value: an array in the current wire map, or a JSON
 *                  array string from older callers
 * @param {string[]} fallback value when the wire value is not a Base name list
 * @return {string[]} ordered Base names
 */
function parseBaseNames(value, fallback) {
	let decoded = value
	if (typeof value === 'string') {
		try {
			decoded = JSON.parse(value)
		} catch {
			return [...fallback]
		}
	}

	if (!Array.isArray(decoded) || decoded.some((name) => typeof name !== 'string')) {
		return [...fallback]
	}
	return [...decoded]
}

/**
 * @param {object} value normalized result
 * @return {object} frozen result
 */
function freeze(value) {
	if (value !== null && typeof value === 'object') {
		Object.values(value).forEach(freeze)
		Object.freeze(value)
	}
	return value
}

/**
 * Decode the app config wire map once.
 *
 * @param {object} wireMap string values from initial state
 * @return {object} frozen normalized config with engines and baseNames
 */
export function decodeConfig(wireMap) {
	const raw = wireMap !== null && typeof wireMap === 'object' ? wireMap : {}

	const engines = {}
	for (const id of engineIds()) {
		engines[id] = isAlwaysOn(id)
			? true
			: parseBoolean(raw[wireKey(id)], wireDefault(id))
	}

	const baseNames = {}
	for (const id of zoneIds()) {
		const configKey = zone(id).configKey
		const fallback = LIST_DEFAULTS[configKey]
		if (!fallback) {
			throw new Error(`no default Base names for zone '${id}' (config key '${configKey}')`)
		}
		baseNames[id] = parseBaseNames(raw[configKey], fallback)
	}

	return freeze({ engines, baseNames })
}
