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
import { registerFileListHeaders, Header } from '@nextcloud/files'
import logger from './logger.js'
import { createPrivateAdapter } from './adapters/privateFiles.js'
import { createMount } from './modules/mount.js'

const HEADER = 'headermd'
const FOOTER = 'footermd'

__webpack_nonce__ = btoa(OC.requestToken) 			 		 // eslint-disable-line
__webpack_public_path__ = OC.linkTo('files_readmemd', 'js/') // eslint-disable-line

document.addEventListener('DOMContentLoaded', () => {

	logger.info('initializing ...')

	let mounts = []

	// create Header object
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
			mounts.push(createMount({
				zone: HEADER,
				fileListAdapter: adapt({
					parent: el,
					position: 'append',
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

	// last step, register the header to filelist
	registerFileListHeaders(ReadmeMDHeader)
})
