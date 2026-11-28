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
		path: {
			type: String,
			default: '',
		},
	},

	watch: {
		election() {
			this.render()
		},

		content() {
			this.render()
		},

		path() {
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
				path: this.path,
				host,
			})
		},
	},
}
</script>
