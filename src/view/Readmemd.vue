<!--
  - SPDX-FileCopyrightText: Matthieu Le Corre <matthieu.lecorre@univ-nantes.fr>
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->

<template>
	<div v-if="election !== null" :class="[ zone ]" :data-filename="election.fileName">
		<RenderEngine :election="election"
			:content="content"
			:mount="fileListAdapter"
			:path="currentPath" />
	</div>
	<p v-else-if="error !== null" class="readmemd-error" role="alert">
		{{ errorMessage }}
	</p>
</template>

<script>
import { computed, onMounted, ref, watch } from 'vue'
import RenderEngine from '../components/RenderEngine.vue'
import logger from '../logger.js'
import { loadState } from '@nextcloud/initial-state'
import { createContentRefresh } from '../modules/contentRefresh.js'
import { decodeConfig } from '../modules/configDecode.js'
import { zoneForDomClass } from '../zones.js'

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
		zone: {
			type: String,
			required: true,
		},
		path: {
			type: String,
			default: '',
		},
	},

	setup(props, { expose }) {
		const config = decodeConfig(loadState('files_readmemd', 'config'))
		const election = ref(null)
		const content = ref(null)
		const error = ref(null)
		const currentPath = ref(props.path)

		const errorMessage = computed(() => {
			if (error.value === null) {
				return ''
			}
			return error.value && error.value.message ? error.value.message : String(error.value)
		})

		// Files renders a header once with '/' and updates it again when the real
		// folder is known. Both refreshes can overlap; the refresh policy owns
		// which result is allowed to reach the DOM.
		const refresh = createContentRefresh({
			zone: zoneForDomClass(props.zone),
			config,
			adapter: props.fileListAdapter,
			logger,
			onResult: (nextElection, nextContent, nextError) => {
				election.value = nextElection
				content.value = nextContent
				error.value = nextError
			},
		})

		/**
		 * @param {string} nextPath directory path
		 * @return {Promise<void>} refresh completion
		 */
		const update = (nextPath) => {
			currentPath.value = nextPath
			return refresh(nextPath)
		}

		expose({ update })
		watch(() => props.path, update)
		onMounted(() => update(props.path))

		return { election, content, error, errorMessage, currentPath }
	},
}
</script>
