// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { createRenderEngine } from '../../src/modules/renderEngine.js'

function deferred() {
	let resolve
	const promise = new Promise((done) => { resolve = done })
	return { promise, resolve }
}

function converter(render) {
	return { use: vi.fn(), render: vi.fn(render) }
}

function harness(overrides = {}) {
	const result = converter(async (content) => '<p>' + content + '</p>')
	const deps = {
		logger: { debug: vi.fn(), error: vi.fn() },
		createConverter: vi.fn(() => result),
		loadMarkdownPlugins: vi.fn(async () => {}),
		...overrides,
	}
	return {
		render: createRenderEngine(deps),
		deps,
		converter: result,
		host: document.createElement('div'),
	}
}

function mountFixture(mode = 'private') {
	return {
		mode,
		currentPath: () => '/docs',
		linkUrl: (link, path) => '/files' + path + '/' + link,
	}
}

function election(engine = 'markdown', fileName = 'README.md') {
	return { fileName, engine, baseName: 'README', hidden: false, reason: 'test election' }
}

describe('createRenderEngine', () => {
	it('renders Markdown markup, class and elected filename into the host', async () => {
		const { render, host, deps, converter: md } = harness()

		await render({ election: election(), content: 'hello', mount: mountFixture(), host })

		expect(host.innerHTML).toBe('<p>hello</p>')
		expect(host.className).toBe('markdown-body')
		expect(host.dataset.filename).toBe('README.md')
		expect(deps.createConverter).toHaveBeenCalledWith({
			engine: 'markdown',
			mount: expect.any(Object),
			path: '/docs',
		})
		expect(md.render).toHaveBeenCalledWith('hello')
	})

	it('dispatches AsciiDoc through the same seam', async () => {
		const { render, host, deps } = harness()
		const mounted = mountFixture()

		await render({ election: election('asciidoc', 'README.adoc'), content: '*bold*', mount: mounted, host })

		expect(deps.createConverter).toHaveBeenCalledWith({
			engine: 'asciidoc',
			mount: mounted,
			path: '/docs',
		})
		expect(deps.loadMarkdownPlugins).not.toHaveBeenCalled()
		expect(host.className).toBe('markdown-body')
	})

	it('passes HTML through without a converter or Markdown plugins', async () => {
		const { render, host, deps } = harness()
		const mounted = mountFixture()

		await render({ election: election('html', 'README.html'), content: '<b>raw</b>', mount: mounted, host })

		expect(host.innerHTML).toBe('<b>raw</b>')
		expect(host.className).toBe('html-body')
		expect(deps.createConverter).not.toHaveBeenCalled()
		expect(deps.loadMarkdownPlugins).not.toHaveBeenCalled()
	})

	it('loads Markdown plugins before converting', async () => {
		const { render, deps, converter: md } = harness()
		const order = []
		deps.loadMarkdownPlugins.mockImplementation(async () => { order.push('plugins') })
		md.render.mockImplementation(async () => { order.push('render'); return '<p>x</p>' })

		await render({ election: election(), content: 'x', mount: mountFixture(), host: document.createElement('div') })

		expect(order).toEqual(['plugins', 'render'])
	})

	it('clears the host and logs for an unknown engine', async () => {
		const { render, host, deps } = harness()
		host.innerHTML = '<p>stale</p>'
		host.className = 'markdown-body'
		host.dataset.filename = 'README.md'

		await render({ election: election('pdf'), content: 'x', mount: mountFixture(), host })

		expect(host.innerHTML).toBe('')
		expect(host.className).toBe('')
		expect(host.dataset.filename).toBeUndefined()
		expect(deps.logger.error).toHaveBeenCalled()
	})

	it('clears the host when no file is elected', async () => {
		const { render, host } = harness()
		host.innerHTML = '<p>stale</p>'
		host.className = 'markdown-body'
		host.dataset.filename = 'README.md'

		await render({ election: null, content: null, mount: mountFixture(), host })

		expect(host.innerHTML).toBe('')
		expect(host.className).toBe('')
		expect(host.dataset.filename).toBeUndefined()
	})

	it('lets the newest overlapping render reach the DOM', async () => {
		const first = deferred()
		const second = deferred()
		let calls = 0
		const { render, host } = harness({
			createConverter: vi.fn(() => {
				calls += 1
				return converter(() => (calls === 1 ? first.promise : second.promise))
			}),
		})
		const request = { election: election(), content: 'x', mount: mountFixture(), host }

		const older = render({ ...request, content: 'old' })
		const newer = render({ ...request, content: 'new' })
		second.resolve('<p>new</p>')
		await newer
		first.resolve('<p>old</p>')
		await older

		expect(host.innerHTML).toBe('<p>new</p>')
		expect(host.dataset.filename).toBe('README.md')
	})

	it('degrades to base markup when a plugin fails to load', async () => {
		const { render, host, deps } = harness({
			loadMarkdownPlugins: vi.fn(async () => { throw new Error('plugin missing') }),
		})

		await expect(render({
			election: election(), content: 'x', mount: mountFixture(), host,
		})).resolves.toBeUndefined()

		expect(host.innerHTML).toBe('<p>x</p>')
		expect(deps.logger.debug).toHaveBeenCalled()
	})

	it('never throws a converter failure to the caller', async () => {
		const { render, host, deps } = harness({
			createConverter: vi.fn(() => converter(async () => { throw new Error('convert failed') })),
		})
		host.innerHTML = '<p>stale</p>'

		await expect(render({
			election: election(), content: 'x', mount: mountFixture(), host,
		})).resolves.toBeUndefined()

		expect(host.innerHTML).toBe('')
		expect(deps.logger.error).toHaveBeenCalled()
	})

	it('disables rendered checkboxes', async () => {
		const { render, host } = harness({
			createConverter: vi.fn(() => converter(async () => '<input type="checkbox">')),
		})

		await render({ election: election(), content: 'x', mount: mountFixture(), host })

		const checkbox = host.querySelector('input[type=checkbox]')
		expect(checkbox).not.toBeNull()
		expect(checkbox.onclick()).toBe(false)
	})

	it('renders the same result for both Zones and both Mounts', async () => {
		for (const [zoneClass, mode] of [['headermd', 'private'], ['footermd', 'public']]) {
			const { render, host } = harness()
			const wrapper = document.createElement('div')
			wrapper.className = zoneClass
			wrapper.appendChild(host)

			await render({ election: election(), content: 'x', mount: mountFixture(mode), host })

			expect(host.innerHTML).toBe('<p>x</p>')
			expect(host.className).toBe('markdown-body')
			expect(wrapper.className).toBe(zoneClass)
		}
	})
})
