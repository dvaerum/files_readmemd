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
import 'github-markdown-css/github-markdown.css'
import logger from './logger.js'
import { createPrivateAdapter, privateFooterLayout } from './adapters/privateFiles.js'
import { createMount } from './modules/mount.js'
import { createHeaderDescriptor, registerHeader } from './modules/registerHeader.js'

__webpack_nonce__ = btoa(OC.requestToken) 			 		 // eslint-disable-line
__webpack_public_path__ = OC.linkTo('files_readmemd', 'js/') // eslint-disable-line

logger.info('initializing ...')

let mounts = []

// Register before Files initializes so its registry always sees this header,
// whatever order the scripts load in. The Zone mounts into the supported slot.
registerHeader(createHeaderDescriptor({
	render(el, folder) {
		mounts.forEach((mount) => mount.destroy())
		mounts = [
			createMount({
				zone: 'headermd',
				fileListAdapter: createPrivateAdapter(
					{ parent: el, position: 'append' },
					{ path: folder.path },
				),
				path: folder.path,
			}),
			createMount({
				zone: 'footermd',
				fileListAdapter: createPrivateAdapter(privateFooterLayout('footermd'), {
					path: folder.path,
				}),
				path: folder.path,
			}),
		]
	},

	updated(folder) {
		mounts.forEach((mount) => mount.update(folder.path))
	},
}))
