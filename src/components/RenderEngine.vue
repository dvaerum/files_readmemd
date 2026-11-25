<!--
  - SPDX-FileCopyrightText: Matthieu Le Corre <matthieu.lecorre@univ-nantes.fr>
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<template>
	<div ref="container" />
</template>

<script>
import { createRenderEngine } from '../modules/renderEngine.js'

export default {
	name: 'RenderEngine',

	props: {
		election: {
			type: Object,
			default: null,
		},
		content: {
			type: String,
			default: '',
		},
		mount: {
			type: Object,
			required: true,
		},
	},

	watch: {
		election() {
			this.render()
		},

		content() {
			this.render()
		},
	},

	created() {
		this.renderElectedFile = createRenderEngine()
	},

	mounted() {
		this.render()
	},

	methods: {
		async render() {
			const host = this.$refs.container
			if (!host) {
				return
			}
			await this.renderElectedFile({
				election: this.election,
				content: this.content,
				mount: this.mount,
				host,
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
