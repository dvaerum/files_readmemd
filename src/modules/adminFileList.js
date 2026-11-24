/**
 * @license AGPL-3.0-or-later
 *
 * This program is free software: you can redistribute it and/or modify it under
 * the terms of the GNU Affero General Public License as published by the Free
 * Software Foundation, either version 3 of the License, or (at your option)
 * any later version.
 *
 * Admin file-list DOM behaviour. The caller owns the network requests; this
 * module owns delegation, list updates and error visibility.
 */

import logger from '../logger.js'

const SUBMIT_PREFIX = 'readmeMD-filelist_submit-'
const NAME_PREFIX = 'readmeMD-filelist_name-'
const LIST_PREFIX = 'readmeMD-filelist_'
const ITEM_PREFIX = 'readmeMD-filelist-'

/**
 * @param {Document} root document containing the admin settings
 * @return {string[]} admin tokens found in the DOM
 */
function zoneTokens(root) {
	return Array.from(root.querySelectorAll('[id^="' + SUBMIT_PREFIX + '"]'))
		.map((element) => element.id.slice(SUBMIT_PREFIX.length))
}

/**
 * Bind add and remove actions for every declared admin file list.
 *
 * @param {Document} root document containing the admin settings
 * @param {object} actions injected operations
 * @param {Function} actions.add called with { zone, fileName }
 * @param {Function} actions.remove called with { zone, fileName }
 * @return {void}
 */
export function bindAdminFileListActions(root, { add, remove }) {
	for (const zone of zoneTokens(root)) {
		const list = root.getElementById(LIST_PREFIX + zone)
		const input = root.getElementById(NAME_PREFIX + zone)
		const submit = root.getElementById(SUBMIT_PREFIX + zone)

		if (!list || !input || !submit) {
			throw new Error('incomplete admin file list for zone ' + zone)
		}

		list.addEventListener('click', async (event) => {
			const button = event.target.closest('.readmeMD-filelist_delete')
			if (!button) {
				return
			}

			const fileName = button.dataset.filename
			try {
				await remove({ zone, fileName })
				button.parentNode.remove()
			} catch (error) {
				logger.error('Failed to remove ' + fileName + ' from ' + zone, error)
			}
		})

		submit.addEventListener('click', async () => {
			const fileName = input.value
			await add({ zone, fileName })

			const item = list.ownerDocument.createElement('li')
			item.className = 'readmeMD-filelist'
			item.id = ITEM_PREFIX + fileName
			const link = list.ownerDocument.createElement('a')
			link.dataset.zone = zone
			link.dataset.filename = fileName
			link.className = 'readmeMD-filelist_delete icon-inline icon icon-delete'
			item.appendChild(link)
			item.appendChild(list.ownerDocument.createTextNode(fileName))
			list.appendChild(item)
		})
	}
}
