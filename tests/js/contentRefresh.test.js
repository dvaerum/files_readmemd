import { describe, expect, it, vi } from 'vitest'
import { createContentRefresh } from '../../src/modules/contentRefresh.js'

const config = {
	engines: { markdown: true, asciidoc: false, html: false },
	baseNames: { headermd: ['HEADER'], footermd: ['README'] },
	flags: {},
}

function deferred() {
	let resolve
	let reject
	const promise = new Promise((done, fail) => { resolve = done; reject = fail })
	return { promise, resolve, reject }
}

function create(options) {
	const onResult = vi.fn()
	const load = options.load ?? vi.fn(async (url) => `content:${url}`)
	const logger = options.logger ?? { error: vi.fn() }
	const refresh = createContentRefresh({
		zone: 'footermd',
		config,
		adapter: {
			directoryNames: async () => options.names,
			downloadUrl: (file, path) => `${path}/${file}`,
		},
		load,
		onResult,
		logger,
	})
	return { refresh, onResult, load, logger }
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
		const logger = { error: vi.fn() }
		const refresh = createContentRefresh({
			zone: 'footermd',
			config,
			adapter,
			load: async (url) => `content:${url}`,
			onResult,
			logger,
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
		const logger = { error: vi.fn() }
		const refresh = createContentRefresh({
			zone: 'footermd',
			config,
			adapter,
			load: async (url) => `content:${url}`,
			onResult,
			logger,
		})

		const stale = refresh('/old')
		await refresh('/empty')
		staleNames.resolve(['README.md'])
		await stale

		expect(onResult).toHaveBeenCalledTimes(1)
		expect(onResult).toHaveBeenCalledWith(null, null)
	})

	it('clears the Zone and logs phase, Zone and path when directory names reject', async () => {
		const failure = new Error('listing failed')
		const adapter = {
			directoryNames: vi.fn(async () => { throw failure }),
			downloadUrl: (file, path) => `${path}/${file}`,
		}
		const onResult = vi.fn()
		const logger = { error: vi.fn() }
		const load = vi.fn()
		const refresh = createContentRefresh({
			zone: 'footermd',
			config,
			adapter,
			load,
			onResult,
			logger,
		})

		await expect(refresh('/docs')).resolves.toBeUndefined()

		expect(onResult).toHaveBeenCalledWith(null, null)
		expect(load).not.toHaveBeenCalled()
		expect(logger.error).toHaveBeenCalledTimes(1)
		const [message, loggedError] = logger.error.mock.calls[0]
		expect(message).toContain('footermd')
		expect(message).toContain('directoryNames')
		expect(message).toContain('/docs')
		expect(loggedError).toBe(failure)
	})

	it('clears the Zone and logs phase, Zone and path when the download rejects', async () => {
		const failure = new Error('download failed')
		const { refresh, onResult, logger } = create({
			names: ['README.md'],
			load: vi.fn(async () => { throw failure }),
		})

		await expect(refresh('/docs')).resolves.toBeUndefined()

		expect(onResult).toHaveBeenCalledWith(null, null)
		expect(logger.error).toHaveBeenCalledTimes(1)
		const [message, loggedError] = logger.error.mock.calls[0]
		expect(message).toContain('footermd')
		expect(message).toContain('load')
		expect(message).toContain('/docs')
		expect(loggedError).toBe(failure)
	})

	it('does not let an older directory failure clear a newer success', async () => {
		const staleNames = deferred()
		const adapter = {
			directoryNames: vi.fn((path) => path === '/old' ? staleNames.promise : Promise.resolve(['README.md'])),
			downloadUrl: (file, path) => `${path}/${file}`,
		}
		const onResult = vi.fn()
		const logger = { error: vi.fn() }
		const refresh = createContentRefresh({
			zone: 'footermd',
			config,
			adapter,
			load: async (url) => `content:${url}`,
			onResult,
			logger,
		})

		const stale = refresh('/old')
		await refresh('/new')
		staleNames.reject(new Error('old listing failed'))
		await expect(stale).resolves.toBeUndefined()

		expect(onResult).toHaveBeenCalledTimes(1)
		expect(onResult).toHaveBeenCalledWith(
			expect.objectContaining({ fileName: 'README.md' }),
			'content:/new/README.md',
		)
		expect(logger.error).not.toHaveBeenCalled()
	})

	it('does not let an older download failure clear a newer success', async () => {
		const staleNames = deferred()
		const freshNames = deferred()
		const staleContent = deferred()
		const freshContent = deferred()
		const load = vi.fn((url) => url.includes('/old/') ? staleContent.promise : freshContent.promise)
		const onResult = vi.fn()
		const logger = { error: vi.fn() }
		const refresh = createContentRefresh({
			zone: 'footermd',
			config,
			adapter: {
				directoryNames: (path) => path === '/old' ? staleNames.promise : freshNames.promise,
				downloadUrl: (file, path) => `${path}/${file}`,
			},
			load,
			onResult,
			logger,
		})

		const stale = refresh('/old')
		staleNames.resolve(['README.md'])
		await vi.waitFor(() => expect(load).toHaveBeenCalledWith('/old/README.md'))
		const fresh = refresh('/new')
		freshNames.resolve(['README.md'])
		freshContent.resolve('new content')
		await fresh
		staleContent.reject(new Error('old download failed'))
		await expect(stale).resolves.toBeUndefined()

		expect(onResult).toHaveBeenCalledTimes(1)
		expect(onResult).toHaveBeenCalledWith(
			expect.objectContaining({ fileName: 'README.md' }),
			'new content',
		)
		expect(logger.error).not.toHaveBeenCalled()
	})

	it('lets a newer download failure clear an older success', async () => {
		const staleContent = deferred()
		const load = vi.fn((url) => url.includes('/old/')
			? staleContent.promise
			: Promise.reject(new Error('new download failed')))
		const { refresh, onResult, logger } = create({ names: ['README.md'], load })

		const stale = refresh('/old')
		await vi.waitFor(() => expect(load).toHaveBeenCalledWith('/old/README.md'))
		staleContent.resolve('old content')
		await stale
		expect(onResult).toHaveBeenLastCalledWith(
			expect.objectContaining({ fileName: 'README.md' }),
			'old content',
		)

		await expect(refresh('/failing')).resolves.toBeUndefined()

		expect(onResult).toHaveBeenLastCalledWith(null, null)
		expect(logger.error).toHaveBeenCalledTimes(1)
	})
})
