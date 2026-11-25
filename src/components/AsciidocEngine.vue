<!--
  - SPDX-FileCopyrightText: Matthieu Le Corre <matthieu.lecorre@univ-nantes.fr>
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<template>
	<div class="markdown-body" v-html="renderedContent" /> <!-- eslint-disable-line -->
</template>

<script>

import asciidoctor from 'asciidoctor'
import logger from '../logger.js'

export default {
	name: 'AsciidocEngine',
	props: {
		content: {
			type: String,
			default: '',
		},
		fileListAdapter: {
			type: Object,
			required: true,
		},
	},

	data() {
		return {
			renderedContent: '',
		}
	},

	watch: {
		async content() {
			this.renderedContent = await this.converter.convert(this.content)
		},

	},
	created() {
		this.converter = asciidoctor()
		logger.debug('AsciiDoc engine loaded')

		// now choose the right CSS
		if (this.fileListAdapter.mode === 'private') {
			if (document.body.dataset.themes.startsWith('dark')) {
				import('github-markdown-css/github-markdown-dark.css')
			}

			if (document.body.dataset.themes.startsWith('light')) {
				import('github-markdown-css/github-markdown-light.css')
			}

			if (document.body.dataset.themes === 'default') {
				import('github-markdown-css/github-markdown.css')
			}
		} else {
			import('github-markdown-css/github-markdown.css')
		}
	},

	async mounted() {
		// The view can publish an election and its content in the same tick.
		// A watcher alone would miss that initial value and leave an empty body.
		if (this.content) {
			this.renderedContent = await this.converter.convert(this.content)
		}
	},
}
</script>
