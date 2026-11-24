/**
 *  - SPDX-FileCopyrightText: Matthieu Le Corre <matthieu.lecorre@univ-nantes.fr>
 *  - SPDX-License-Identifier: AGPL-3.0-or-later
 */

import Vue from 'vue'
import Readmemd from './view/Readmemd.vue'
import logger from './logger.js'
import { zone } from './zones.js'

const ReadmemdView = Vue.extend(Readmemd)
const HEADER = zone('headermd')
const FOOTER = zone('footermd')

__webpack_nonce__ = btoa(OC.requestToken) 			 		 // eslint-disable-line
__webpack_public_path__ = OC.linkTo('files_readmemd', 'js/') // eslint-disable-line

document.addEventListener('DOMContentLoaded', () => {

	let HeaderView
	let FooterView
	logger.info('Initializing for public page ...')
	// wait for filelist to be ready
	const fileSharingReady = new Promise(resolve => {
		const interval = setInterval(() => {
			console.debug(OCA.Sharing.PublicApp)
			if (OCA.Sharing.PublicApp.fileList.files !== undefined) {
				clearInterval(interval)
				resolve()
			}
		}, 1000)
	})

	fileSharingReady.then(() => {
		logger.info('FileTable is ready ! ')
		const folder = {
			path: OCA.Sharing.PublicApp.fileList._currentDirectory,
		}

		let headerElement
		if (!document.querySelector('.' + HEADER.domClass)) {
			headerElement = document.createElement('div')
			document.querySelector('.filelist-header').append(headerElement)
		} else {
			headerElement = document.querySelector('.' + HEADER.domClass)

		}

		HeaderView = new ReadmemdView({
			data: {
				name: 'readmemd-' + HEADER.adminToken,
				zone: HEADER.domClass,
				path: folder.path,
			},
		})

		let footerElement

		if (!document.querySelector('.' + FOOTER.domClass)) {
			footerElement = document.createElement('div')
			document.querySelector('.filelist-footer').append(footerElement)
		} else {
			footerElement = document.querySelector('.' + FOOTER.domClass)

		}

		FooterView = new ReadmemdView({
			data: {
				name: 'readmemd-' + FOOTER.adminToken,
				zone: FOOTER.domClass,
				path: folder.path,
			},
		})

		HeaderView.$mount(headerElement)
		FooterView.$mount(footerElement)

	})

})
