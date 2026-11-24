import { describe, expect, it, vi } from 'vitest'
import { createMarkdownConverter } from '../../src/modules/markdownConverter.js'

const converter = (overrides = {}) => createMarkdownConverter({
	linkUrl: vi.fn((link) => '/files/' + link),
	previewUrl: '/core/preview',
	...overrides,
})

describe('createMarkdownConverter', () => {
	it('uses only supported markdown-it options', () => {
		const options = converter().options

		expect(options).toMatchObject({ html: false, breaks: true, linkify: true, typographer: true })
		expect(options).not.toHaveProperty('computer')
	})

	it('resolves relative links through the injected adapter and opens them in a new tab', () => {
		const linkUrl = vi.fn((link) => '/remote/' + link)
		const html = converter({ linkUrl }).render('[image](picture.png)')

		expect(linkUrl).toHaveBeenCalledWith('picture.png', '')
		expect(html).toContain('href="/remote/picture.png"')
		expect(html).toContain('target="_blank"')
	})

	it('leaves absolute and preview links to the browser', () => {
		const linkUrl = vi.fn(() => '/rewritten')
		const html = converter({ linkUrl }).render([
			'[web](https://example.org)',
			'[mail](mailto:user@example.org)',
			'[preview](/core/preview?fileId=1)',
		].join('\n\n'))

		expect(linkUrl).not.toHaveBeenCalled()
		expect(html).toContain('href="https://example.org"')
		expect(html).toContain('href="mailto:user@example.org"')
		expect(html).toContain('href="/core/preview?fileId=1"')
	})

	it('passes the current path to the adapter for relative links', () => {
		const linkUrl = vi.fn((link, path) => '/files' + path + '/' + link)
		const html = createMarkdownConverter({ linkUrl, previewUrl: '/core/preview', path: '/docs' })
			.render('[note](note.md)')

		expect(linkUrl).toHaveBeenCalledWith('note.md', '/docs')
		expect(html).toContain('href="/files/docs/note.md"')
	})
})
