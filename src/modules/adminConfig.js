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
 * Admin configuration module. One binding owns engine controls, Zone file
 * lists, endpoint mapping and request handling. The request adapter is the seam:
 * production supplies axios, tests supply a local fake. The DOM changes only
 * after a request succeeds; every failure is logged and leaves the DOM intact.
 */

import axios from '@nextcloud/axios'
import { generateOcsUrl } from '@nextcloud/router'
import { adminControlId, configurableEngineIds, wireKey } from '../engines.js'
import logger from '../logger.js'
import { encodePathSegment } from './pathSegment.js'
import { zone, zoneForAdminToken, zoneIds } from '../zones.js'

const CONFIG_ENDPOINT = 'apps/files_readmemd/api/v1/config'
const SUBMIT_PREFIX = 'readmeMD-filelist_submit-'
const NAME_PREFIX = 'readmeMD-filelist_name-'
const LIST_PREFIX = 'readmeMD-filelist_'
const ITEM_PREFIX = 'readmeMD-filelist-'
const ROW_TEMPLATE_ID = 'readmeMD-filelist-row-template'
const FORM_HEADERS = { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' }

/**
 * Production request adapter: one descriptor in, one axios promise out.
 *
 * @param {object} descriptor request descriptor
 * @param {string} descriptor.method HTTP method
 * @param {string} descriptor.url generated URL
 * @param {URLSearchParams} [descriptor.params] form body for engine saves
 * @return {Promise} axios response
 */
function axiosRequest({ method, url, params }) {
	if (method === 'post') {
		return axios.post(url, params, { headers: FORM_HEADERS })
	}
	if (method === 'put') {
		return axios.put(url)
	}
	if (method === 'delete') {
		return axios.delete(url)
	}
	throw new Error('unsupported admin config request method ' + method)
}

/**
 * @return {object[]} engine element id and wire key descriptors
 */
function engineDescriptors() {
	return configurableEngineIds().map((id) => ({
		elementId: adminControlId(id),
		key: wireKey(id),
	}))
}

/**
 * @return {object[]} Zone declarations in declaration order
 */
function zoneDescriptors() {
	return zoneIds().map((id) => zone(id))
}

/**
 * Derive the file-name endpoint from the Zone declaration.
 *
 * @param {string} adminToken admin token from the DOM
 * @param {string} fileName elected Base name
 * @return {string} generated endpoint URL
 */
function fileNameUrl(adminToken, fileName) {
	const { endpointSegment } = zone(zoneForAdminToken(adminToken))
	return generateOcsUrl(CONFIG_ENDPOINT + '/filenames/' + endpointSegment + '/' + encodePathSegment(fileName))
}

/**
 * Append one Base name row by cloning the PHP-owned row prototype.
 *
 * @param {Element} list Zone list element
 * @param {string} adminToken admin token from the declaration
 * @param {string} fileName elected Base name
 * @param {HTMLTemplateElement} template hidden row prototype from the PHP view
 * @return {void}
 */
function appendItem(list, adminToken, fileName, template) {
	const row = template.content.firstElementChild
	if (!row) {
		throw new Error('Base name row prototype has no row')
	}

	const item = row.cloneNode(true)
	item.id = ITEM_PREFIX + fileName
	const link = item.querySelector('a')
	if (!link) {
		throw new Error('Base name row prototype has no delete link')
	}
	link.dataset.zone = adminToken
	link.dataset.filename = fileName
	item.appendChild(list.ownerDocument.createTextNode(fileName))
	list.appendChild(item)
}

/**
 * Bind every admin control in a settings document to one request seam.
 *
 * @param {Document} root document containing the admin settings
 * @param {object} [options] binding options
 * @param {Function} [options.request] request({ method, url, params? })
 * @return {void}
 */
export function bindAdminConfig(root, { request = axiosRequest } = {}) {
	const rowTemplate = root.getElementById(ROW_TEMPLATE_ID)
	if (!rowTemplate) {
		throw new Error('missing Base name row prototype ' + ROW_TEMPLATE_ID)
	}

	for (const { elementId, key } of engineDescriptors()) {
		const input = root.getElementById(elementId)
		if (!input) {
			throw new Error('missing admin engine control ' + elementId)
		}

		input.addEventListener('click', async (event) => {
			const params = new URLSearchParams() // eslint-disable-line
			params.append('key', key)
			params.append('value', event.target.checked)
			try {
				await request({ method: 'post', url: generateOcsUrl(CONFIG_ENDPOINT), params })
			} catch (error) {
				logger.error('Failed to save ' + key, error)
			}
		})
	}

	for (const { adminToken } of zoneDescriptors()) {
		const list = root.getElementById(LIST_PREFIX + adminToken)
		const name = root.getElementById(NAME_PREFIX + adminToken)
		const submit = root.getElementById(SUBMIT_PREFIX + adminToken)
		if (!list || !name || !submit) {
			throw new Error('incomplete admin file list for zone ' + adminToken)
		}

		list.addEventListener('click', async (event) => {
			const button = event.target.closest('.readmeMD-filelist_delete')
			if (!button) {
				return
			}

			const fileName = button.dataset.filename
			try {
				await request({ method: 'delete', url: fileNameUrl(adminToken, fileName) })
			} catch (error) {
				logger.error('Failed to remove ' + fileName + ' from ' + adminToken, error)
				return
			}
			button.parentNode.remove()
		})

		submit.addEventListener('click', async () => {
			const fileName = name.value
			try {
				await request({ method: 'put', url: fileNameUrl(adminToken, fileName) })
			} catch (error) {
				logger.error('Failed to add ' + fileName + ' to ' + adminToken, error)
				return
			}
			appendItem(list, adminToken, fileName, rowTemplate)
		})
	}
}
