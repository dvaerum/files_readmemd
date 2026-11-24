<!--
  - SPDX-FileCopyrightText: Matthieu Le Corre <matthieu.lecorre@univ-nantes.fr>
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<template>
	<div ref="container" class="markdown-body" v-html="renderedContent" /> <!-- eslint-disable-line -->
</template>

<script>
import { generateUrl } from '@nextcloud/router'
import logger from '../logger.js'
import { createMarkdownConverter } from '../modules/markdownConverter.js'

export default {
	name: 'MarkdownEngine',
	props: {
		content: {
			type: String,
			default: '',
		},
		fileListAdapter: {
			type: Object,
			required: true,
		},
		path: {
			type: String,
			default: '',
		},
	},

	data() {
		return {
			renderedContent: '',
		}
	},

	watch: {
		async content() {
			this.renderedContent = await this.renderMD()
		},

	},

	created() {

		this.converter = createMarkdownConverter({
			linkUrl: (link, path) => this.fileListAdapter.linkUrl(link, path),
			previewUrl: generateUrl('core/preview'),
			path: () => this.path,
		})

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

		logger.debug('Markdown engine loaded')

	},

	updated() {
		this.forceCheckBox()
	},

	methods: {

		async renderMD() {

			await this.loadAdditionnalMDPlugins(this.converter)
			return this.converter.render(this.content)
		},

		async loadAdditionnalMDPlugins(converter) {

			const promiseList = []

			/** highlightjs */
			if (this.content.indexOf('```') !== -1) {
				promiseList.push(import(/* webpackChunkName: "m-it-highlightjs" */ 'markdown-it-highlightjs').then(module => {
					import(/* webpackChunkName: "m-it-highlightjs-css" */ 'highlight.js/styles/github.css')
					converter.use(module.default)
					logger.debug('highlightjs loaded')
				}))
			}

			/** Mermaid */
			if (this.content.match(/(gantt|sequenceDiagram|graph (?:TB|BT|RL|LR|TD))/) !== null) {
				promiseList.push(import(/* webpackChunkName: "m-it-mermaid" */ '@wekanteam/markdown-it-mermaid').then(module => {
					converter.use(module.default)
					logger.debug('Mermaid loaded')
				}))
			}

			/** Latex */
			if (this.content.indexOf('$') !== -1) {
				promiseList.push(import(/* webpackChunkName: "katex" */ 'katex'))
				promiseList.push(import(/* webpackChunkName: "m-it-katex" */ '@vscode/markdown-it-katex').then(module => {
					converter.use(module.default)
					logger.debug('Katex loaded')
				}))
			}

			return Promise.all(promiseList)

		},

		forceCheckBox() {
			const checkboxs = this.$refs.container.querySelectorAll('input[type=checkbox]');
			[].forEach.call(checkboxs, (cb) => {
				cb.onclick = function() { return false }
			})
		},
	},

}
</script>

<style>
.headermd ul,
.footermd ul
{
	list-style: initial ;
}

.headermd thead,
.footermd thead
{
	position: initial !important;
}

.markdown-body em {
	font-style:italic ;
}

.markdown-body {
    background-color: transparent ;
}

.markdown-body .info {
    background-color: var(--callout-background, var(--color-background-hover));
    border-left: 10px solid var(--color-info) ;
    padding: 1em ;
    margin: 1em ;
    border-radius: var(--border-radius)
}

.markdown-body .warn {
    background-color: var(--callout-background, var(--color-background-hover));
    border-left: 10px solid var(--color-warning) ;
    padding: 1em ;
    margin: 1em ;
    border-radius: var(--border-radius)
}

.markdown-body .error {
    background-color: var(--callout-background, var(--color-background-hover));
    border-left: 10px solid var(--color-error) ;
    padding: 1em ;
    margin: 1em ;
    border-radius: var(--border-radius)
}

.markdown-body .success {
    background-color: var(--callout-background, var(--color-background-hover));
    border-left: 10px solid var(--color-success) ;
    padding: 1em ;
    margin: 1em ;
    border-radius: var(--border-radius)
}

</style>
