/**
 * @license AGPL-3.0-or-later
 *
 * This program is free software: you can redistribute it and/or modify it under
 * the terms of the GNU Affero General Public License as published by the Free
 * Software Foundation, either version 3 of the License, or (at your option)
 * any later version.
 */

import declaration from '../zones.json'

const FIELDS = ['adminToken', 'configKey', 'domClass', 'endpointSegment', 'responseSemantics']

/**
 * Fail at module load if the declaration cannot be interpreted. Every reverse
 * lookup below relies on each field value naming exactly one zone.
 *
 * @param {object} candidate decoded declaration
 * @return {object} the validated declaration
 */
export function validateDeclaration(candidate) {
	if (candidate === null || typeof candidate !== 'object' || Array.isArray(candidate)) {
		throw new Error('zone declaration must be an object')
	}

	const seen = {}
	for (const [id, rawZone] of Object.entries(candidate)) {
		if (!id) {
			throw new Error('zone declaration has an empty zone id')
		}
		if (rawZone === null || typeof rawZone !== 'object' || Array.isArray(rawZone)) {
			throw new Error(`zone '${id}' must be an object`)
		}
		for (const field of FIELDS) {
			const value = rawZone[field]
			if (typeof value !== 'string' || value.trim() === '') {
				throw new Error(`zone '${id}' must define a non-empty string '${field}'`)
			}
			if (seen[field] && seen[field][value]) {
				throw new Error(`duplicate '${field}' value '${value}' in zone declaration`)
			}
			seen[field] = { ...seen[field], [value]: id }
		}
	}

	const ids = Object.keys(candidate)
	if (ids.length === 0) {
		throw new Error('zone declaration has no zones')
	}
	return candidate
}

const zones = validateDeclaration(declaration)

/**
 * @return {string[]} canonical zone ids, in declaration order
 */
export function zoneIds() {
	return Object.keys(zones)
}

/**
 * @param {string} id canonical zone id
 * @return {object} the zone's four spellings
 */
export function zone(id) {
	if (!Object.prototype.hasOwnProperty.call(zones, id)) {
		throw new Error(`unknown zone '${id}'`)
	}
	return zones[id]
}

export function hasZone(id) {
	return Object.prototype.hasOwnProperty.call(zones, id)
}

function idFor(field, value) {
	const found = zoneIds().find((id) => zones[id][field] === value)
	if (found === undefined) {
		throw new Error(`unknown zone '${field}' value '${value}'`)
	}
	return found
}

export function zoneForAdminToken(token) {
	return idFor('adminToken', token)
}

export function zoneForConfigKey(configKey) {
	return idFor('configKey', configKey)
}

export function zoneForDomClass(domClass) {
	return idFor('domClass', domClass)
}

export function zoneForEndpointSegment(segment) {
	return idFor('endpointSegment', segment)
}

export function hasAdminToken(token) {
	return zoneIds().some((id) => zones[id].adminToken === token)
}
