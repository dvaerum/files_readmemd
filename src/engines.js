/**
 * @license AGPL-3.0-or-later
 *
 * This program is free software: you can redistribute it and/or modify it under
 * the terms of the GNU Affero General Public License as published by the Free
 * Software Foundation, either version 3 of the License, or (at your option)
 * any later version.
 */

import declaration from '../engines.json'

/**
 * Fail at module load if the declaration cannot be interpreted. File election
 * rank is derived from declaration order, and every reverse lookup below relies
 * on each value naming exactly one Render engine.
 *
 * @param {object} candidate decoded declaration
 * @return {object} the validated declaration
 */
export function validateDeclaration(candidate) {
	if (candidate === null || typeof candidate !== 'object' || Array.isArray(candidate)) {
		throw new Error('engine declaration must be an object')
	}

	const ids = Object.keys(candidate)
	if (ids.length === 0) {
		throw new Error('engine declaration has no engines')
	}

	const seen = { extensions: {}, wireKeys: {}, adminControls: {} }
	for (const [id, rawEngine] of Object.entries(candidate)) {
		if (!id) {
			throw new Error('engine declaration has an empty engine id')
		}
		if (rawEngine === null || typeof rawEngine !== 'object' || Array.isArray(rawEngine)) {
			throw new Error(`engine '${id}' must be an object`)
		}
		if (!Array.isArray(rawEngine.extensions) || rawEngine.extensions.length === 0) {
			throw new Error(`engine '${id}' must define a non-empty 'extensions' list`)
		}
		for (const extension of rawEngine.extensions) {
			if (typeof extension !== 'string' || extension.trim() === '') {
				throw new Error(`engine '${id}' has an invalid extension`)
			}
			if (seen.extensions[extension]) {
				throw new Error(`duplicate '${extension}' extension in engine declaration`)
			}
			seen.extensions[extension] = id
		}

		if (typeof rawEngine.alwaysOn !== 'boolean') {
			throw new Error(`engine '${id}' must define a boolean 'alwaysOn'`)
		}
		if (typeof rawEngine.wireDefault !== 'boolean') {
			throw new Error(`engine '${id}' must define a boolean 'wireDefault'`)
		}
		if (rawEngine.alwaysOn) {
			if (rawEngine.wireKey !== null) {
				throw new Error(`engine '${id}' must not define 'wireKey' when always on`)
			}
		} else {
			if (typeof rawEngine.wireKey !== 'string' || rawEngine.wireKey.trim() === '') {
				throw new Error(`engine '${id}' must define a non-empty string 'wireKey'`)
			}
			if (seen.wireKeys[rawEngine.wireKey]) {
				throw new Error(`duplicate '${rawEngine.wireKey}' wire key in engine declaration`)
			}
			seen.wireKeys[rawEngine.wireKey] = id
		}

		if (typeof rawEngine.adminControlId !== 'string' || rawEngine.adminControlId.trim() === '') {
			throw new Error(`engine '${id}' must define a non-empty string 'adminControlId'`)
		}
		if (seen.adminControls[rawEngine.adminControlId]) {
			throw new Error(`duplicate '${rawEngine.adminControlId}' admin control in engine declaration`)
		}
		seen.adminControls[rawEngine.adminControlId] = id
	}

	return candidate
}

const engines = validateDeclaration(declaration)

/**
 * @return {string[]} canonical Render engine ids, in declaration order
 */
export function engineIds() {
	return Object.keys(engines)
}

/**
 * @param {string} id canonical Render engine id
 * @return {object} the engine's declared facts
 */
export function engine(id) {
	if (!Object.prototype.hasOwnProperty.call(engines, id)) {
		throw new Error(`unknown engine '${id}'`)
	}
	return engines[id]
}

/**
 * @param {string} id canonical Render engine id
 * @return {boolean} whether the declaration contains the engine
 */
export function hasEngine(id) {
	return Object.prototype.hasOwnProperty.call(engines, id)
}

/**
 * Rank is the engine's position in the declaration, one-based.
 *
 * @param {string} id canonical Render engine id
 * @return {number} File election rank
 */
export function rank(id) {
	const index = engineIds().indexOf(id)
	if (index === -1) {
		throw new Error(`unknown engine '${id}'`)
	}
	return index + 1
}

/**
 * @param {string} id canonical Render engine id
 * @return {string[]} ordered file extensions, from generic to specific
 */
export function extensions(id) {
	return engine(id).extensions
}

/**
 * @param {string} id canonical Render engine id
 * @return {string|null} wire key, or null for an always-on engine
 */
export function wireKey(id) {
	return engine(id).wireKey
}

/**
 * @param {string} id canonical Render engine id
 * @return {boolean} decoded value when the wire key is absent
 */
export function wireDefault(id) {
	return engine(id).wireDefault
}

/**
 * @param {string} id canonical Render engine id
 * @return {boolean} whether the engine has no wire setting
 */
export function isAlwaysOn(id) {
	return engine(id).alwaysOn
}

/**
 * @param {string} id canonical Render engine id
 * @return {string} admin settings control id
 */
export function adminControlId(id) {
	return engine(id).adminControlId
}

/**
 * @return {string[]} engine ids that have a wire setting
 */
export function configurableEngineIds() {
	return engineIds().filter((id) => !isAlwaysOn(id))
}

/**
 * @param {string} field declared field used for the lookup
 * @param {*} value declared value to reverse
 * @param {Function} lookup predicate over each engine and the value
 * @return {string} canonical Render engine id
 */
function idFor(field, value, lookup) {
	const found = engineIds().find((id) => lookup(engine(id), value))
	if (found === undefined) {
		throw new Error(`unknown engine '${field}' value '${value}'`)
	}
	return found
}

/**
 * @param {string} key wire setting key
 * @return {string} canonical Render engine id
 */
export function engineForWireKey(key) {
	return idFor('wireKey', key, (candidate, value) => candidate.wireKey === value)
}

/**
 * @param {string} controlId admin settings control id
 * @return {string} canonical Render engine id
 */
export function engineForAdminControlId(controlId) {
	return idFor('adminControlId', controlId, (candidate, value) => candidate.adminControlId === value)
}

/**
 * @param {string} extension file extension without the dot
 * @return {string} canonical Render engine id
 */
export function engineForExtension(extension) {
	return idFor('extensions', extension, (candidate, value) => candidate.extensions.includes(value))
}

/**
 * @param {string} extension file extension without the dot
 * @return {boolean} whether any engine declares the extension
 */
export function hasExtension(extension) {
	return engineIds().some((id) => engine(id).extensions.includes(extension))
}
