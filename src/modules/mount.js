/**
 * @license AGPL-3.0-or-later
 *
 * One mount lifecycle for private and public shares. The wrapper is a custom
 * element so it cannot be replaced by a Vue component root transition; the
 * adapter resolves its parent on every path change so a replaced header slot
 * is picked up without observing DOM mutations.
 */

import { createApp } from 'vue'
import Readmemd from '../view/Readmemd.vue'
import { zone } from '../zones.js'

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
	 * Adapters resolve their parent lazily: Files replaces the header slot's
	 * children when a folder view changes.
	 *
	 * @return {object} resolved mount point
	 */
	const resolve = () => {
		const point = fileListAdapter.mountPoint(definition)
		return {
			...point,
			parent: typeof point.parent === 'function' ? point.parent() : point.parent,
		}
	}

	const container = document.createElement('readmemd-zone')
	container.className = definition.domClass
	container.dataset.zone = zoneId

	/**
	 * @param {Element} target parent element
	 * @param {string} position 'append' or 'after'
	 * @return {void}
	 */
	const insert = (target, position) => {
		if (!target) {
			return
		}
		if (position === 'after' && target.parentNode) {
			target.parentNode.insertBefore(container, target.nextSibling)
		} else {
			target.appendChild(container)
		}
	}

	const initial = resolve()
	if (initial.existing && initial.existing.parentNode) {
		initial.existing.parentNode.insertBefore(container, initial.existing)
		initial.existing.remove()
	} else {
		insert(initial.parent, initial.position)
	}

	const app = createApp(Readmemd, {
		fileListAdapter,
		zone: definition.domClass,
		path,
	})
	const view = app.mount(container)

	/** @return {void} reattach only when a folder change removed the wrapper */
	const reattach = () => {
		if (destroyed || container.isConnected) {
			return
		}
		const current = resolve()
		insert(current.parent, current.position)
	}

	/**
	 * @param {string} newPath directory path
	 * @return {void}
	 */
	const setPath = (newPath) => {
		if (destroyed) {
			return
		}
		if (typeof view.update === 'function') {
			view.update(newPath)
		}
		reattach()
	}

	const unsubscribe = typeof fileListAdapter.onPathChange === 'function'
		? fileListAdapter.onPathChange(setPath)
		: () => {}

	return {
		update: setPath,

		destroy() {
			destroyed = true
			unsubscribe()
			app.unmount()
			container.remove()
		},
	}
}
