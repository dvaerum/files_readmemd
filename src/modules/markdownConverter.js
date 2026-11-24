/**
 * @license AGPL-3.0-or-later
 *
 * This program is free software: you can redistribute it and/or modify it under
 * the terms of the GNU Affero General Public License as published by the Free
 * Software Foundation, either version 3 of the License, or (at your option)
 * any later version.
 *
 * Markdown converter construction. Link resolution is injected so the
 * converter never reads Nextcloud globals and can be exercised without Vue.
 */

import markdownit from 'markdown-it'
import markdownitcontainer from 'markdown-it-container'
import markdownittasklist from 'markdown-it-task-lists'
import implicitFigures from 'markdown-it-image-figures'
import markdownitimsize from 'markdown-it-imsize'
import markdownitanchor from 'markdown-it-anchor'
import markdownittocdoneright from 'markdown-it-toc-done-right'
import markdownitreplacelink from 'markdown-it-replace-link'
import { full as markdownitemoji } from 'markdown-it-emoji'

/**
 * @param {object} options converter options
 * @param {Function} options.linkUrl resolve a relative link via the mount adapter
 * @param {string} options.previewUrl Nextcloud preview URL prefix
 * @param {string|Function} [options.path] current directory, or a getter for it
 * @return {object} configured markdown-it converter
 */
export function createMarkdownConverter({ linkUrl, previewUrl, path = '' }) {
	const slugify = (s) => 'md-' + encodeURIComponent(String(s).trim().toLowerCase().replace(/\s+/g, '-'))
	const currentPath = () => (typeof path === 'function' ? path() : path)

	const converter = markdownit({ html: false, breaks: true, linkify: true, typographer: true })
		.enable('strikethrough')
		.enable('table')
		.use(markdownitcontainer, 'info')
		.use(markdownitcontainer, 'warn')
		.use(markdownitcontainer, 'error')
		.use(markdownitcontainer, 'success')
		.use(markdownittasklist, { enabled: true })
		.use(implicitFigures)
		.use(markdownitimsize)
		.use(markdownitemoji)
		.use(markdownitanchor, { slugify })
		.use(markdownittocdoneright)
		.use(markdownitreplacelink, {
			replaceLink: (link) => {
				if (link.startsWith('mailto:') || link.startsWith('http://')
					|| link.startsWith('https://') || link.startsWith(previewUrl)) {
					return link
				}
				return linkUrl(link, currentPath())
			},
		})

	const defaultRender = converter.renderer.rules.link_open || function(tokens, idx, options, env, self) {
		return self.renderToken(tokens, idx, options)
	}

	converter.renderer.rules.link_open = function(tokens, idx, options, env, self) {
		const aIndex = tokens[idx].attrIndex('target')
		if (aIndex < 0) {
			tokens[idx].attrPush(['target', '_blank'])
		} else {
			tokens[idx].attrs[aIndex][1] = '_blank'
		}
		return defaultRender(tokens, idx, options, env, self)
	}

	return converter
}
