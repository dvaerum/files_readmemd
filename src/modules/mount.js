/**
 * @license AGPL-3.0-or-later
 *
 * This program is free software: you can redistribute it and/or modify it under
 * the terms of the GNU Affero General Public License as published by the Free
 * Software Foundation, either version 3 of the License, or (at your option)
 * any later version.
 *
 * One mount lifecycle for private and public shares. This module owns a stable
 * wrapper and its Vue root; adapters supply layout, names, URLs and path changes.
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
	let destroyed = false

	/**
	 * Adapters may resolve the parent lazily: Vue replaces its own header slot
	 * when a folder view changes, so an element captured earlier can go stale.
	 *
	 * @return {object} resolved mount point
	 */
	const resolve = () => {
		const mountPoint = fileListAdapter.mountPoint(definition)
		return {
			...mountPoint,
			parent: typeof mountPoint.parent === 'function' ? mountPoint.parent() : mountPoint.parent,
		}
	}

	const observer = typeof MutationObserver === 'function'
		? new MutationObserver(() => reattach())
		: null
	let observed = new Set()

	const observe = (targets) => {
		if (!observer) {
			return
		}
		const next = new Set(targets.filter((target) => target && target !== document.body))
		if (next.size === observed.size && [...next].every((target) => observed.has(target))) {
			return
		}
		observer.disconnect()
		observed = next
		for (const target of observed) {
			observer.observe(target, { childList: true })
		}
	}

	const insert = (element, target, position) => {
		if (position === 'after') {
			target.parentNode.insertBefore(element, target.nextSibling)
		} else {
			target.appendChild(element)
		}
		observe([target, target.parentNode])
	}

	// The view renders a comment placeholder when no file is elected. Vue
	// replaces its own root on that transition, so keep a separate wrapper that
	// survives it and is the element this mount owns.
	const container = document.createElement('div')
	const initial = resolve()
	const mountTarget = initial.existing || document.createElement('div')

	if (initial.existing) {
		initial.existing.parentNode.insertBefore(container, initial.existing)
	} else {
		insert(container, initial.parent, initial.position)
	}
	container.appendChild(mountTarget)

	const view = new ReadmemdView({
		propsData: { fileListAdapter },
		data: {
			name: 'readmemd-' + definition.adminToken,
			zone: definition.domClass,
			path,
		},
	}).$mount(mountTarget)
	observe([container.parentNode, container.parentNode && container.parentNode.parentNode])

	const reattach = () => {
		if (destroyed || container.isConnected) {
			return
		}
		const current = resolve()
		if (current.parent) {
			insert(container, current.parent, current.position)
		}
	}

	const setPath = (newPath) => {
		view.path = newPath
		reattach()
	}
	const unsubscribe = typeof fileListAdapter.onPathChange === 'function'
		? fileListAdapter.onPathChange(setPath)
		: () => {}

	return {
		/** @param {string} newPath directory path */
		update: setPath,

		destroy() {
			destroyed = true
			if (observer) {
				observer.disconnect()
			}
			unsubscribe()
			view.$destroy()
			if (container.parentNode) {
				container.parentNode.removeChild(container)
			}
		},
	}
}
