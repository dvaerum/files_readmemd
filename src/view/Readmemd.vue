<!--
  - SPDX-FileCopyrightText: Matthieu Le Corre <matthieu.lecorre@univ-nantes.fr>
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->

<template>
	<div v-if="election !== null" :class="[ zone ]" :data-filename="election.fileName">
		<MarkdownEngine v-if="election.engine === 'markdown'"
			:content="content"
			:mode="mode"
			:path="path" />
		<HtmlEngine v-if="election.engine === 'html'" :content="content" />
		<AsciidocEngine v-if="election.engine === 'asciidoc'"
			:content="content"
			:mode="mode" />
	</div>
</template>

<script>
import MarkdownEngine from '../components/MarkdownEngine.vue'
import HtmlEngine from '../components/HtmlEngine.vue'
import AsciidocEngine from '../components/AsciidocEngine.vue'
import axios from '@nextcloud/axios'
import { generateUrl } from '@nextcloud/router'
import logger from '../logger.js'
import { loadState } from '@nextcloud/initial-state'
import { electForZone } from '../modules/fileElection.js'
import { zone, zoneForDomClass } from '../zones.js'

const FOOTER = zone('footermd')

export default {
	name: 'Readmemd',

	components: {
		MarkdownEngine,
		HtmlEngine,
		AsciidocEngine,
	},

	data() {
		return {
			config: loadState('files_readmemd', 'config'),
			election: null,
			fileTableView: {},
			path: null,
			content: null,
		}
	},

	computed: {
		zoneId() {
			return zoneForDomClass(this.zone)
		},

		mode() {
			const IS_PUBLIC = !!(document.getElementById('isPublic'))

			if (IS_PUBLIC) {
				return 'public'
			} else {
				return 'private'
			}
		},

	},

	watch: {
		async path() {
			this.content = await this.fillContent()
			if (this.zone === FOOTER.domClass && this.content !== null) {
				this.adjustCSS()
			}
		},
	},

	async mounted() {
		this.content = await this.fillContent()
		if (this.zone === FOOTER.domClass && this.content !== null) {
			this.adjustCSS()
		}
	},

	methods: {
		adjustCSS() {

			let container

			if (this.mode === 'private') {
				container = '.files-list'
			} else {
				container = '#files-public-content > #preview'
			}
			document.querySelector(container).style.setProperty('overflow', 'unset')
			document.querySelector(container + ' > table > tbody').style.setProperty('min-height', 'unset')
			document.querySelector(container + ' > table > tfoot').style.setProperty('min-height', 'unset')
			document.querySelector(container + ' > table > tfoot').style.setProperty('height', '65px')
			document.querySelector(container + ' > table > tfoot > tr').style.setProperty('height', '65px')
		},

		async directoryNames() {
			if (this.mode === 'public') {
				return OCA.Sharing.PublicApp.fileList.files
					.filter((file) => file.type === 'file')
					.map((file) => file.name)
			}

			const { contents } = await this.fileTableView.getContents(this.path)
			return contents
				.filter((file) => file.type === 'file')
				.map((file) => file.basename)
		},

		async fillContent() {
			this.election = electForZone({
				zone: this.zoneId,
				config: this.config,
				directoryNames: await this.directoryNames(),
			})

			if (this.election === null) {
				logger.debug('[' + this.zone + '] No file elected for path ' + this.path)
				return null
			}

			logger.debug('[' + this.zone + '] File elected: ' + this.election.fileName
				+ ' (' + this.election.reason + ') for path ' + this.path)
			return await this.getFile(this.election.fileName)
		},

		async getFile(fileName) {
			let URL

			if (this.mode === 'public') {
				const token = document.getElementById('sharingToken').value

				URL = generateUrl('/s/{token}/download?path={path}&files={file}',
					{
						token,
						path: this.path,
						file: fileName,
					},
				)
			} else {
				const dir = this.path.replace('?', '%3F')
				const fname = fileName.replace('?', '%3F')
				URL = OC.linkToRemoteBase('files' + dir + '/' + fname)
			}

			const response = await axios.get(URL)
			return response.data
		},
	},
}

</script>

<style scoped>
.footermd {
	padding: 1em ;
	border-top: 1px solid silver ;
	margin-top: 1em ;
	text-align: initial ;
}

.headermd {
	padding: 1em ;
	border-bottom: 1px solid silver ;
	text-align: initial ;
	z-index: 59 ;
}

</style>
