/**
 * @author Matthieu Le Corre <matthieu.lecorre@univ-nantes.fr>
 *
 * @license AGPL-3.0-or-later
 *
 * This program is free software: you can redistribute it and/or modify it under
 * the terms of the GNU Affero General Public License as
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
import { bindAdminFileListActions } from './modules/adminFileList.js'
import { zone, zoneForAdminToken } from './zones.js'

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

	// Fileslists — the DOM helper owns delegation and list updates; this file
	// only maps the admin token to the endpoint declared in zones.json.

	const urlFor = (adminToken, fileName) => {
		const { endpointSegment } = zone(zoneForAdminToken(adminToken))
		return 'apps/files_readmemd/config/filenames/' + endpointSegment + '/' + fileName.replace('?', '%3F')
	}

	bindAdminFileListActions(document, {
		add: ({ zone: adminToken, fileName }) => axios.put(generateUrl(urlFor(adminToken, fileName))),
		remove: ({ zone: adminToken, fileName }) => axios.delete(generateUrl(urlFor(adminToken, fileName))),
	})

})
