/**
 *  - SPDX-FileCopyrightText: Matthieu Le Corre <matthieu.lecorre@univ-nantes.fr>
 *  - SPDX-License-Identifier: AGPL-3.0-or-later
 */

import logger from './logger.js'
import { createPublicAdapter } from './adapters/publicShare.js'
import { createMount } from './modules/mount.js'

__webpack_nonce__ = btoa(OC.requestToken) 			 		 // eslint-disable-line
__webpack_public_path__ = OC.linkTo('files_readmemd', 'js/') // eslint-disable-line

document.addEventListener('DOMContentLoaded', () => {

	logger.info('Initializing for public page ...')

	const adapter = createPublicAdapter()
	adapter.whenReady().then(() => {
		logger.info('FileTable is ready ! ')
		const path = adapter.currentPath()
		const mounts = [
			createMount({ zone: 'headermd', fileListAdapter: adapter, path }),
			createMount({ zone: 'footermd', fileListAdapter: adapter, path }),
		]

		window.addEventListener('beforeunload', () => {
			mounts.forEach((mount) => mount.destroy())
		}, { once: true })
	})
})
