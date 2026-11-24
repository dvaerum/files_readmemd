/**
 * @license AGPL-3.0-or-later
 *
 * This program is free software: you can redistribute it and/or modify it under
 * the terms of the GNU Affero General Public License as published by the Free
 * Software Foundation, either version 3 of the License, or (at your option)
 * any later version.
 *
 * One mount lifecycle for private and public shares. This module owns the Vue
 * root and its node; adapters supply layout, names, URLs and path changes.
 */

import Vue from 'vue'
import Readmemd from '../view/Readmemd.vue'
import { zone } from '../zones.js'

const ReadmemdView = Vue.extend(Readmemd)

/**
 * @param {object} options mount options
 * @param {string} options.zone canonical zone id from zones.json
 * @param {object} options.fileListAdapter adapter at the mount seam
 * @param {string} options.path initial directory path
 * @return {object} mount with update(path) and destroy()
 */
export function createMount({ zone: zoneId, fileListAdapter, path }) {
	const definition = zone(zoneId)
	const mountPoint = fileListAdapter.mountPoint(definition)
	let node = mountPoint.existing || document.createElement('div')

	if (!mountPoint.existing) {
		if (mountPoint.position === 'after') {
			mountPoint.parent.parentNode.insertBefore(node, mountPoint.parent.nextSibling)
		} else {
			mountPoint.parent.appendChild(node)
		}
	}

	const view = new ReadmemdView({
		propsData: { fileListAdapter },
		data: {
			name: 'readmemd-' + definition.adminToken,
			zone: definition.domClass,
			path,
		},
	}).$mount(node)
	node = view.$el

	const setPath = (newPath) => { view.path = newPath }
	const unsubscribe = typeof fileListAdapter.onPathChange === 'function'
		? fileListAdapter.onPathChange(setPath)
		: () => {}

	return {
		/** @param {string} newPath directory path */
		update: setPath,

		destroy() {
			unsubscribe()
			view.$destroy()
			if (node.parentNode) {
				node.parentNode.removeChild(node)
			}
		},
	}
}
