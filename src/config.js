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
 *
 */

import { generateUrl } from '@nextcloud/router'
import axios from '@nextcloud/axios'
import logger from './logger.js'
import { zone, zoneIds } from './zones.js'

document.addEventListener('DOMContentLoaded', () => {

	// Engines

	document.getElementById('readmeMD-engine-asciidoc').onclick = function(Event) {
		const params = new URLSearchParams() // eslint-disable-line
		params.append('key', 'show_asciidoc')
		params.append('value', Event.target.checked)

		axios.post(
			generateUrl('apps/files_readmemd/config'),
			params,
			{
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
				},
			},
		)
			.catch(function(error) {
				logger.error('Failed to save show_asciidoc', error)
			})
	}

	document.getElementById('readmeMD-engine-html').onclick = function(Event) {
		const params = new URLSearchParams() // eslint-disable-line
		params.append('key', 'show_html')
		params.append('value', Event.target.checked)

		axios.post(
			generateUrl('apps/files_readmemd/config'),
			params,
			{
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
				},
			},
		)
			.catch(function(error) {
				logger.error('Failed to save show_html', error)
			})
	}

	// Fileslists — one handler per declared zone, no duplicated spellings.

	for (const id of zoneIds()) {
		const { adminToken, endpointSegment } = zone(id)
		const listId = 'readmeMD-filelist_' + adminToken
		const urlFor = (fn) => 'apps/files_readmemd/config/filenames/' + endpointSegment + '/' + fn.replace('?', '%3F')

		// DELETE — delegate on the list so entries added after load get a handler too.
		document.getElementById(listId).addEventListener('click', function(Event) {
			const button = Event.target.closest('.readmeMD-filelist_delete')
			if (!button) {
				return
			}

			const fn = button.dataset.filename

			axios.delete(generateUrl(urlFor(fn)))
				.then(function() {
					button.parentNode.remove()
				})
				.catch(function(error) {
					logger.error('Failed to remove ' + fn + ' from ' + adminToken, error)
				})
		})

		// ADD
		document.getElementById('readmeMD-filelist_submit-' + adminToken).onclick = function() {
			const fn = document.getElementById('readmeMD-filelist_name-' + adminToken).value

			axios.put(generateUrl(urlFor(fn)))
				.then(function() {
					document.getElementById(listId).insertAdjacentHTML('beforeend',
						'<li class="readmeMD-filelist" id="readmeMD-filelist-' + fn + '">'
                         + '<a data-zone="' + adminToken + '" data-filename="' + fn + '" class="readmeMD-filelist_delete icon-inline icon icon-delete"></a>'
                         + fn + '</li>')
				})
		}
	}

})
