/**
 * @license AGPL-3.0-or-later
 *
 * This program is free software: you can redistribute it and/or modify it under
 * the terms of the GNU Affero General Public License as published by the Free
 * Software Foundation, either version 3 of the License, or (at your option)
 * any later version.
 *
 * Who renders a README and which variant wins are policy decisions. They live
 * here so every mount asks the same question and the view only renders the
 * answer. See docs/adr/0001-file-election-policy.md for the tie-break.
 */

import { hasZone } from '../zones.js'

const ENGINE_EXTENSIONS = {
	markdown: ['md', 'markdown'],
	asciidoc: ['adoc', 'asciidoc'],
	html: ['htm', 'html'],
}

const ENGINE_ORDER = ['markdown', 'asciidoc', 'html']
const ENGINE_RANK = { markdown: 1, asciidoc: 2, html: 3 }

/**
 * Internal seam: pick the engine for a file name, honouring optional flags.
 *
 * @param {string} fileName file name including its extension
 * @param {object} config normalized app config
 * @return {string} engine name or 'Unsupported Engine'
 */
function engineType(fileName, config) {
	if (!fileName) {
		return 'Unsupported Engine'
	}

	const ext = fileName.slice(fileName.lastIndexOf('.') + 1).toLowerCase()

	for (const engine of ENGINE_ORDER) {
		if (!ENGINE_EXTENSIONS[engine].includes(ext)) {
			continue
		}
		if (config.engines[engine]) {
			return engine
		}
	}

	return 'Unsupported Engine'
}

/**
 * Internal seam: every enabled candidate with its tie-break coordinates.
 *
 * @param {string} zoneId canonical zone id from zones.json
 * @param {object} config normalized app config
 * @return {object[]} candidates in declaration order
 */
function candidateFiles(zoneId, config) {
	const baseNames = config.baseNames[zoneId]
	const candidates = []

	baseNames.forEach((baseName, baseIndex) => {
		for (const engine of ENGINE_ORDER) {
			if (!config.engines[engine]) {
				continue
			}

			ENGINE_EXTENSIONS[engine].forEach((extension, extensionIndex) => {
				candidates.push({
					fileName: baseName + '.' + extension,
					baseName,
					baseIndex,
					engine,
					extensionIndex,
					hidden: false,
				})
				candidates.push({
					fileName: '.' + baseName + '.' + extension,
					baseName,
					baseIndex,
					engine,
					extensionIndex,
					hidden: true,
				})
			})
		}
	})

	return candidates
}

/**
 * Highest priority first: later base, then higher engine rank, then hidden,
 * then the later extension. This is the old "last match wins" loop made
 * explicit; see ADR-0001.
 *
 * @param {object} left first candidate
 * @param {object} right second candidate
 * @return {number} negative when left wins
 */
function comparePriority(left, right) {
	return right.baseIndex - left.baseIndex
		|| ENGINE_RANK[right.engine] - ENGINE_RANK[left.engine]
		|| Number(right.hidden) - Number(left.hidden)
		|| right.extensionIndex - left.extensionIndex
}

/**
 * Elect the single README file a zone should render.
 *
 * @param {object} request election request
 * @param {string} request.zone canonical zone id from zones.json
 * @param {object} request.config app config wire map
 * @param {string[]} request.directoryNames file names in the current directory
 * @return {object|null} elected file and why it won, or null when nothing matches
 */
export function electForZone({ zone: zoneId, config, directoryNames }) {
	if (!hasZone(zoneId)) {
		throw new Error(`unknown zone '${zoneId}'`)
	}

	const present = new Set(directoryNames)
	const winner = candidateFiles(zoneId, config)
		.sort(comparePriority)
		.find((candidate) => present.has(candidate.fileName))

	if (!winner) {
		return null
	}

	return {
		fileName: winner.fileName,
		engine: engineType(winner.fileName, config),
		baseName: winner.baseName,
		hidden: winner.hidden,
		reason: winner.hidden
			? `hidden ${winner.engine} variant of base '${winner.baseName}'`
			: `visible ${winner.engine} variant of base '${winner.baseName}'`,
	}
}
