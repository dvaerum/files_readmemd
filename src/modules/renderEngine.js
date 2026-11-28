/**
 * @license AGPL-3.0-or-later
 *
 * This program is free software: you can redistribute it and/or modify it under
 * the terms of the GNU Affero General Public License as published by the Free
 * Software Foundation, either version 3 of the License, or (at your option)
 * any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * The Render engine module. One seam turns a File election and its README
 * content file into rendered markup inside a Zone host. Engine dispatch,
 * plugin preparation, converter construction, async markup and checkbox
 * disabling all sit behind that seam; the view only publishes the election.
 * Dependencies are injected at construction so production supplies real
 * adapters and tests supply local stand-ins.
 */

import { generateUrl } from '@nextcloud/router'
import { hasEngine } from '../engines.js'
import logger from '../logger.js'
import { createMarkdownConverter } from './markdownConverter.js'

/**
 * Private implementation: load the optional Markdown plugins the content
 * needs, then let the converter use them before it renders.
 *
 * @param {object} converter markdown-it converter
 * @param {string} content README content file
 * @return {Promise<void>} resolves once every requested plugin is ready
 */
async function loadMarkdownPlugins(converter, content) {
	const pending = []

	if (content.includes('```')) {
		pending.push(import(/* webpackChunkName: "m-it-highlightjs" */ 'markdown-it-highlightjs').then(module => {
			import(/* webpackChunkName: "m-it-highlightjs-css" */ 'highlight.js/styles/github.css')
			converter.use(module.default)
		}))
	}

	if (/(gantt|sequenceDiagram|graph (?:TB|BT|RL|LR|TD))/.test(content)) {
		pending.push(import(/* webpackChunkName: "m-it-mermaid" */ '@wekanteam/markdown-it-mermaid').then(module => {
			converter.use(module.default)
		}))
	}

	if (content.includes('$')) {
		pending.push(import(/* webpackChunkName: "katex" */ 'katex'))
		pending.push(import(/* webpackChunkName: "m-it-katex" */ '@vscode/markdown-it-katex').then(module => {
			converter.use(module.default)
		}))
	}

	await Promise.all(pending)
}

/**
 * Private implementation: build the converter for the elected Render engine.
 *
 * @param {object} request converter request
 * @param {string} request.engine canonical Render engine name
 * @param {object} request.mount Mount adapter
 * @param {string} request.path current directory
 * @return {Promise<object>} converter with use() and render()
 */
async function createConverter({ engine, mount, path }) {
	if (engine === 'asciidoc') {
		const { default: asciidoctor } = await import('asciidoctor')
		const converter = asciidoctor()
		return { use() {}, render: (content) => converter.convert(content) }
	}

	return createMarkdownConverter({
		linkUrl: (link, currentPath) => mount.linkUrl(link, currentPath),
		previewUrl: generateUrl('core/preview'),
		path,
	})
}

/**
 * @return {object} production dependencies behind the Render engine seam
 */
function productionDependencies() {
	return { logger, createConverter, loadMarkdownPlugins }
}

/**
 * Create the Render engine. Every call returns one rendering function with its
 * own latest-wins generation counter, so overlapping folder refreshes cannot
 * let an older result reach the DOM. Theme CSS is loaded once by the bundles;
 * the stylesheet follows Nextcloud's theming custom properties.
 *
 * @param {object} [overrides] injected dependencies for tests
 * @return {Function} async renderElectedFile(request)
 */
export function createRenderEngine(overrides = {}) {
	const deps = { ...productionDependencies(), ...overrides }
	let generation = 0

	const log = (level, message) => {
		if (typeof deps.logger[level] === 'function') {
			deps.logger[level](message, { app: 'readmemd' })
		}
	}

	/**
	 * Render the elected README content file into a Zone host.
	 *
	 * @param {object} request render request
	 * @param {object|null} request.election File election result or null
	 * @param {string|null} request.content decoded README content file
	 * @param {object} request.mount Mount adapter
	 * @param {string} [request.path] current directory
	 * @param {Element} request.host element that receives the markup
	 * @return {Promise<void>} resolves once the host reflects the result
	 */
	return async function renderElectedFile({ election, content, mount, path, host }) {
		const current = ++generation
		const currentPath = path === undefined && mount && typeof mount.currentPath === 'function'
			? mount.currentPath()
			: (path || '')

		/**
		 * Write only when this render is still the newest one.
		 *
		 * @param {string} html rendered markup
		 * @param {string} className body class for the Render engine
		 * @param {string|null} fileName elected file name
		 * @return {void}
		 */
		const write = (html, className, fileName) => {
			if (current !== generation || !host) {
				return
			}
			host.className = className
			host.innerHTML = html
			if (fileName) {
				host.dataset.filename = fileName
			} else {
				delete host.dataset.filename
			}
			host.querySelectorAll('input[type=checkbox]').forEach((checkbox) => {
				checkbox.onclick = () => false
			})
		}

		if (!election || !hasEngine(election.engine)) {
			if (election) {
				log('error', 'Unsupported render engine ' + election.engine)
			}
			write('', '', null)
			return
		}

		const body = content === null || content === undefined ? '' : String(content)
		try {
			if (election.engine === 'html') {
				write(body, 'html-body', election.fileName)
				return
			}

			const converter = await deps.createConverter({ engine: election.engine, mount, path: currentPath })
			if (election.engine === 'markdown') {
				try {
					await deps.loadMarkdownPlugins(converter, body)
				} catch {
					log('debug', 'Markdown plugins unavailable; rendering base markup')
				}
			}

			const html = await converter.render(body)
			write(html, 'markdown-body', election.fileName)
		} catch {
			log('error', 'Failed to render ' + election.fileName)
			write('', '', null)
		}
	}
}
