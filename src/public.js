/**
 *  - SPDX-FileCopyrightText: Matthieu Le Corre <matthieu.lecorre@univ-nantes.fr>
 *  - SPDX-License-Identifier: AGPL-3.0-or-later
 */

import 'github-markdown-css/github-markdown.css'
import logger from './logger.js'
import { createPublicAdapter } from './adapters/publicShare.js'
import { createMount } from './modules/mount.js'

__webpack_nonce__ = btoa(OC.requestToken) 			 		 // eslint-disable-line
__webpack_public_path__ = OC.linkTo('files_readmemd', 'js/') // eslint-disable-line

document.addEventListener('DOMContentLoaded', () => {

	logger.info('Initializing for public page ...')

	const adapter = createPublicAdapter()

	// Core's share view appears asynchronously. The readiness probe is bounded,
	// so a share without a file list logs once instead of waiting forever.
	adapter.whenReady().then(() => {
		logger.info('Share view is ready')

		const path = adapter.currentPath()
		const mounts = [
			createMount({ zone: 'headermd', fileListAdapter: adapter, path }),
			createMount({ zone: 'footermd', fileListAdapter: adapter, path }),
		]

		const unsubscribe = adapter.onPathChange((nextPath) => {
			mounts.forEach((mount) => mount.update(nextPath))
		})

		window.addEventListener('beforeunload', () => {
			unsubscribe()
			mounts.forEach((mount) => mount.destroy())
		}, { once: true })
	}).catch((error) => {
		logger.error('Public share view did not become ready', { error })
	})
})
