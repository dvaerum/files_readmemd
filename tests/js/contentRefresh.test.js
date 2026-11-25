import { describe, expect, it, vi } from 'vitest'
import { createContentRefresh } from '../../src/modules/contentRefresh.js'

const config = {
	show_asciidoc: 'false',
	show_html: 'false',
	fileslist_header: ['HEADER'],
	fileslist_footer: ['README'],
}

function deferred() {
	let resolve
	const promise = new Promise((done) => { resolve = done })
	return { promise, resolve }
}

function create(options) {
	const onResult = vi.fn()
	const load = options.load ?? vi.fn(async (url) => `content:${url}`)
	const refresh = createContentRefresh({
		zone: 'footermd',
		config,
		adapter: {
			directoryNames: async () => options.names,
			downloadUrl: (file, path) => `${path}/${file}`,
		},
		load,
		onResult,
	})
	return { refresh, onResult, load }
}

describe('createContentRefresh', () => {
	it('publishes the newest directory names when an older lookup finishes later', async () => {
		const staleNames = deferred()
		const freshNames = deferred()
		const adapter = {
			directoryNames: vi.fn((path) => path === '/old' ? staleNames.promise : freshNames.promise),
			downloadUrl: (file, path) => `${path}/${file}`,
		}
		const onResult = vi.fn()
		const refresh = createContentRefresh({
			zone: 'footermd',
			config,
			adapter,
			load: async (url) => `content:${url}`,
			onResult,
		})

		const stale = refresh('/old')
		const fresh = refresh('/new')
		freshNames.resolve(['README.md'])
		await fresh
		staleNames.resolve(['README.markdown'])
		await stale

		expect(onResult).toHaveBeenCalledTimes(1)
		expect(onResult).toHaveBeenCalledWith(
			expect.objectContaining({ fileName: 'README.md' }),
			'content:/new/README.md',
		)
	})

	it('publishes the newest content when an older download finishes later', async () => {
		const staleContent = deferred()
		const freshContent = deferred()
		const load = vi.fn((url) => url.includes('/old/') ? staleContent.promise : freshContent.promise)
		const { refresh, onResult } = create({ names: ['README.md'], load })

		const stale = refresh('/old')
		const fresh = refresh('/new')
		await Promise.resolve()
		await Promise.resolve()
		freshContent.resolve('new content')
		await fresh
		staleContent.resolve('old content')
		await stale

		expect(onResult).toHaveBeenCalledTimes(1)
		expect(onResult).toHaveBeenCalledWith(
			expect.objectContaining({ fileName: 'README.md' }),
			'new content',
		)
	})

	it('clears the zone when the newest directory elects no file', async () => {
		const { refresh, onResult, load } = create({ names: [] })

		await refresh('/empty')

		expect(onResult).toHaveBeenCalledWith(null, null)
		expect(load).not.toHaveBeenCalled()
	})

	it('does not republish a stale file after a newer directory cleared the zone', async () => {
		const staleNames = deferred()
		const adapter = {
			directoryNames: vi.fn((path) => path === '/old' ? staleNames.promise : Promise.resolve([])),
			downloadUrl: (file, path) => `${path}/${file}`,
		}
		const onResult = vi.fn()
		const refresh = createContentRefresh({
			zone: 'footermd',
			config,
			adapter,
			load: async (url) => `content:${url}`,
			onResult,
		})

		const stale = refresh('/old')
		await refresh('/empty')
		staleNames.resolve(['README.md'])
		await stale

		expect(onResult).toHaveBeenCalledTimes(1)
		expect(onResult).toHaveBeenCalledWith(null, null)
	})
})
