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
import { Header } from '@nextcloud/files'
import logger from './logger.js'
import { createPrivateAdapter } from './adapters/privateFiles.js'
import { createMount } from './modules/mount.js'
import { registerHeader } from './modules/registerHeader.js'

const HEADER = 'headermd'
const FOOTER = 'footermd'

__webpack_nonce__ = btoa(OC.requestToken) 			 		 // eslint-disable-line
__webpack_public_path__ = OC.linkTo('files_readmemd', 'js/') // eslint-disable-line

logger.info('initializing ...')

let mounts = []

// Register before the Files app initializes so its lazy header registry always
// sees this header, whatever order the scripts load in.
const ReadmeMDHeader = new Header({
	id: 'readmemd',
	order: 100,

	enabled(folder, view) {
		return view.id === 'files' || view.id === 'files.public' || view.id === 'favorites'
	},

	async render(el, folder, view) {
		mounts.forEach((mount) => mount.destroy())
		mounts = []

		const adapt = (layout) => createPrivateAdapter(view, layout)
		// Newer Files hosts own the header slot's children, so the zone lives
		// beside that slot instead of inside it.
		const modernHeader = el.closest && el.closest('.files-list__header-readmemd')
		mounts.push(createMount({
			zone: HEADER,
			fileListAdapter: adapt({
				parent: () => (modernHeader
					? (document.querySelector('.files-list__header-readmemd') || modernHeader)
					: el),
				position: modernHeader ? 'after' : 'append',
			}),
			path: folder.path,
		}))
		mounts.push(createMount({
			zone: FOOTER,
			fileListAdapter: adapt({
				parent: () => document.querySelector('.files-list'),
				position: 'after',
			}),
			path: folder.path,
		}))
	},

	updated(folder, view) {
		mounts.forEach((mount) => mount.update(folder.path))
	},
})

registerHeader(ReadmeMDHeader)
