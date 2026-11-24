<!--
  - SPDX-FileCopyrightText: Matthieu Le Corre <matthieu.lecorre@univ-nantes.fr>
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->

<template>
	<div v-if="election !== null" :class="[ zone ]" :data-filename="election.fileName">
		<MarkdownEngine v-if="election.engine === 'markdown'"
			:content="content"
			:file-list-adapter="fileListAdapter"
			:path="path" />
		<HtmlEngine v-if="election.engine === 'html'" :content="content" />
		<AsciidocEngine v-if="election.engine === 'asciidoc'"
			:content="content"
			:file-list-adapter="fileListAdapter" />
	</div>
</template>

<script>
import MarkdownEngine from '../components/MarkdownEngine.vue'
import HtmlEngine from '../components/HtmlEngine.vue'
import AsciidocEngine from '../components/AsciidocEngine.vue'
import axios from '@nextcloud/axios'
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

	props: {
		fileListAdapter: {
			type: Object,
			required: true,
		},
	},

	data() {
		return {
			config: loadState('files_readmemd', 'config'),
			election: null,
			path: null,
			content: null,
		}
	},

	computed: {
		zoneId() {
			return zoneForDomClass(this.zone)
		},

	},

	watch: {
		async path() {
			await this.refresh()
		},
	},

	async mounted() {
		await this.refresh()
	},

	methods: {
		async refresh() {
			this.election = electForZone({
				zone: this.zoneId,
				config: this.config,
				directoryNames: await this.fileListAdapter.directoryNames(this.path),
			})

			if (this.election === null) {
				logger.debug('[' + this.zone + '] No file elected for path ' + this.path)
				this.content = null
				return
			}

			logger.debug('[' + this.zone + '] File elected: ' + this.election.fileName
				+ ' (' + this.election.reason + ') for path ' + this.path)
			const url = this.fileListAdapter.downloadUrl(this.election.fileName, this.path)
			const response = await axios.get(url)
			this.content = response.data

			if (this.zone === FOOTER.domClass && this.content !== null) {
				this.adjustCSS()
			}
		},

		adjustCSS() {
			const container = this.fileListAdapter.footerContainer()
			if (!container) {
				return
			}
			container.style.setProperty('overflow', 'unset')

			for (const element of container.querySelectorAll(':scope > table > tbody, :scope > table > tfoot')) {
				element.style.setProperty('min-height', 'unset')
			}

			for (const element of container.querySelectorAll(':scope > table > tfoot, :scope > table > tfoot > tr')) {
				element.style.setProperty('height', '65px')
			}
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
