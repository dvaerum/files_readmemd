<!--
  - SPDX-FileCopyrightText: Matthieu Le Corre <matthieu.lecorre@univ-nantes.fr>
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->

<template>
	<div v-if="election !== null" :class="[ zone ]" :data-filename="election.fileName">
		<RenderEngine :election="election" :content="content" :mount="fileListAdapter" />
	</div>
</template>

<script>
import RenderEngine from '../components/RenderEngine.vue'
import axios from '@nextcloud/axios'
import logger from '../logger.js'
import { loadState } from '@nextcloud/initial-state'
import { createContentRefresh } from '../modules/contentRefresh.js'
import { decodeConfig } from '../modules/configDecode.js'
import { zone, zoneForDomClass } from '../zones.js'

const FOOTER = zone('footermd')

export default {
	name: 'Readmemd',

	components: {
		RenderEngine,
	},

	props: {
		fileListAdapter: {
			type: Object,
			required: true,
		},
	},

	data() {
		return {
			config: decodeConfig(loadState('files_readmemd', 'config')),
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
		path(newPath) {
			this.refresh(newPath)
		},
	},

	created() {
		// Files renders a header once with '/' and updates it again when the
		// real folder is known. Both refreshes can overlap, so a single policy
		// decides which result is allowed to reach the DOM.
		this.refresh = createContentRefresh({
			zone: this.zoneId,
			config: this.config,
			adapter: this.fileListAdapter,
			load: async (url) => {
				const response = await axios.get(url)
				return response.data
			},
			onResult: (election, content) => {
				this.election = election
				this.content = content
				if (election === null) {
					logger.debug('[' + this.zone + '] No file elected for path ' + this.path)
					return
				}
				logger.debug('[' + this.zone + '] File elected: ' + election.fileName
					+ ' (' + election.reason + ') for path ' + this.path)
				if (this.zone === FOOTER.domClass && content !== null) {
					this.adjustCSS()
				}
			},
		})
	},

	async mounted() {
		await this.refresh(this.path)
	},

	methods: {
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
