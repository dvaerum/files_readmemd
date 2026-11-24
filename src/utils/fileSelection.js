/**
 * @author Matthieu Le Corre <matthieu.lecorre@univ-nantes.fr>
 *
 * @license AGPL-3.0-or-later
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import { zone } from '../zones.js'

const ENGINE_EXTENSIONS = {
	markdown: ['md', 'markdown'],
	asciidoc: ['adoc', 'asciidoc'],
	html: ['htm', 'html'],
}

/**
 * Pick the engine for a file name, honouring the optional engines' flags.
 *
 * @param {string} fileName file name including its extension
 * @param {object} config app config
 * @return {string} engine name or 'Unsupported Engine'
 */
export function engineType(fileName, config) {
	if (!fileName) {
		return 'Unsupported Engine'
	}

	const ext = fileName.substr(fileName.lastIndexOf('.') + 1).toLowerCase()

	for (const [engine, extensions] of Object.entries(ENGINE_EXTENSIONS)) {
		if (!extensions.includes(ext)) {
			continue
		}
		if (engine === 'markdown' || config['show_' + engine] === 'true') {
			return engine
		}
	}

	return 'Unsupported Engine'
}

/**
 * Build the file-name candidates for a header or footer zone, in priority order.
 *
 * @param {string} zoneId canonical zone id from zones.json
 * @param {object} config app config
 * @return {string[]} candidate file names
 */
export function fileNamesForZone(zoneId, config) {
	const baseNames = config[zone(zoneId).configKey]
	const names = []

	for (const base of baseNames) {
		for (const engine of ['markdown', 'asciidoc', 'html']) {
			if (engine !== 'markdown' && config['show_' + engine] !== 'true') {
				continue
			}
			for (const ext of ENGINE_EXTENSIONS[engine]) {
				names.push(base + '.' + ext)
			}
			for (const ext of ENGINE_EXTENSIONS[engine]) {
				names.push('.' + base + '.' + ext)
			}
		}
	}

	return names
}
