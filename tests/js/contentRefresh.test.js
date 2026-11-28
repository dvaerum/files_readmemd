import { describe, expect, it, vi } from 'vitest'
import { createContentRefresh } from '../../src/modules/contentRefresh.js'

const config = {
	engines: { markdown: true, asciidoc: false, html: false },
	baseNames: { headermd: ['HEADER'], footermd: ['README'] },
}

function deferred() {
	let resolve
	let reject
	const promise = new Promise((done, fail) => { resolve = done; reject = fail })
	return { promise, resolve, reject }
}

function create(options) {
	const onResult = vi.fn()
	const logger = options.logger ?? { error: vi.fn() }
	const adapter = options.adapter ?? {
		directoryNames: async () => options.names ?? [],
		loadContent: options.loadContent ?? vi.fn(async (file, path) => `content:${path}/${file}`),
	}
	const refresh = createContentRefresh({
		zone: 'footermd',
		config,
		adapter,
		onResult,
		logger,
	})
	return { refresh, onResult, adapter, logger }
}

describe('createContentRefresh', () => {
	it('publishes the newest directory names when an older lookup finishes later', async () => {
		const staleNames = deferred()
		const freshNames = deferred()
		const adapter = {
			directoryNames: vi.fn((path) => path === '/old' ? staleNames.promise : freshNames.promise),
			loadContent: vi.fn(async (file, path) => `content:${path}/${file}`),
		}
		const { refresh, onResult } = create({ adapter })

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
			null,
		)
	})

	it('publishes the newest content when an older load finishes later', async () => {
		const staleContent = deferred()
		const freshContent = deferred()
		const adapter = {
			directoryNames: async () => ['README.md'],
			loadContent: vi.fn((file, path) => path.startsWith('/old') ? staleContent.promise : freshContent.promise),
		}
		const { refresh, onResult } = create({ adapter })

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
			null,
		)
	})

	it('clears the zone when the newest directory elects no file', async () => {
		const { refresh, onResult, adapter } = create({ names: [] })

		await refresh('/empty')

		expect(onResult).toHaveBeenCalledWith(null, null, null)
		expect(adapter.loadContent).not.toHaveBeenCalled()
	})

	it('does not republish a stale file after a newer directory cleared the zone', async () => {
		const staleNames = deferred()
		const adapter = {
			directoryNames: vi.fn((path) => path === '/old' ? staleNames.promise : Promise.resolve([])),
			loadContent: vi.fn(async (file, path) => `content:${path}/${file}`),
		}
		const { refresh, onResult } = create({ adapter })

		const stale = refresh('/old')
		await refresh('/empty')
		staleNames.resolve(['README.md'])
		await stale

		expect(onResult).toHaveBeenCalledTimes(1)
		expect(onResult).toHaveBeenCalledWith(null, null, null)
	})

	it('reports a directory listing failure with phase, Zone and path', async () => {
		const failure = new Error('listing failed')
		const { refresh, onResult, logger, adapter } = create({
			adapter: {
				directoryNames: vi.fn(async () => { throw failure }),
				loadContent: vi.fn(),
			},
		})

		await expect(refresh('/docs')).resolves.toBeUndefined()

		expect(onResult).toHaveBeenCalledWith(null, null, failure)
		expect(adapter.loadContent).not.toHaveBeenCalled()
		expect(logger.error).toHaveBeenCalledTimes(1)
		const [message, loggedError] = logger.error.mock.calls[0]
		expect(message).toContain('footermd')
		expect(message).toContain('directoryNames')
		expect(message).toContain('/docs')
		expect(loggedError).toBe(failure)
	})

	it('reports a content load failure with phase, Zone and path', async () => {
		const failure = new Error('load failed')
		const { refresh, onResult, logger } = create({
			names: ['README.md'],
			loadContent: vi.fn(async () => { throw failure }),
		})

		await expect(refresh('/docs')).resolves.toBeUndefined()

		expect(onResult).toHaveBeenCalledWith(null, null, failure)
		expect(logger.error).toHaveBeenCalledTimes(1)
		const [message, loggedError] = logger.error.mock.calls[0]
		expect(message).toContain('footermd')
		expect(message).toContain('loadContent')
		expect(message).toContain('/docs')
		expect(loggedError).toBe(failure)
	})

	it('does not let an older directory failure clear a newer success', async () => {
		const staleNames = deferred()
		const adapter = {
			directoryNames: vi.fn((path) => path === '/old' ? staleNames.promise : Promise.resolve(['README.md'])),
			loadContent: vi.fn(async (file, path) => `content:${path}/${file}`),
		}
		const { refresh, onResult, logger } = create({ adapter })

		const stale = refresh('/old')
		await refresh('/new')
		staleNames.reject(new Error('old listing failed'))
		await expect(stale).resolves.toBeUndefined()

		expect(onResult).toHaveBeenCalledTimes(1)
		expect(onResult).toHaveBeenCalledWith(
			expect.objectContaining({ fileName: 'README.md' }),
			'content:/new/README.md',
			null,
		)
		expect(logger.error).not.toHaveBeenCalled()
	})

	it('does not let an older content failure clear a newer success', async () => {
		const staleNames = deferred()
		const freshNames = deferred()
		const staleContent = deferred()
		const freshContent = deferred()
		const adapter = {
			directoryNames: (path) => path === '/old' ? staleNames.promise : freshNames.promise,
			loadContent: vi.fn((file, path) => path.startsWith('/old') ? staleContent.promise : freshContent.promise),
		}
		const { refresh, onResult, logger } = create({ adapter })

		const stale = refresh('/old')
		staleNames.resolve(['README.md'])
		await vi.waitFor(() => expect(adapter.loadContent).toHaveBeenCalledWith('README.md', '/old'))
		const fresh = refresh('/new')
		freshNames.resolve(['README.md'])
		freshContent.resolve('new content')
		await fresh
		staleContent.reject(new Error('old load failed'))
		await expect(stale).resolves.toBeUndefined()

		expect(onResult).toHaveBeenCalledTimes(1)
		expect(onResult).toHaveBeenCalledWith(
			expect.objectContaining({ fileName: 'README.md' }),
			'new content',
			null,
		)
		expect(logger.error).not.toHaveBeenCalled()
	})

	it('lets a newer content failure clear an older success', async () => {
		const staleContent = deferred()
		const adapter = {
			directoryNames: async () => ['README.md'],
			loadContent: vi.fn((file, path) => path.startsWith('/old')
				? staleContent.promise
				: Promise.reject(new Error('new load failed'))),
		}
		const { refresh, onResult, logger } = create({ adapter })

		const stale = refresh('/old')
		await vi.waitFor(() => expect(adapter.loadContent).toHaveBeenCalledWith('README.md', '/old'))
		staleContent.resolve('old content')
		await stale
		expect(onResult).toHaveBeenLastCalledWith(
			expect.objectContaining({ fileName: 'README.md' }),
			'old content',
			null,
		)

		await expect(refresh('/failing')).resolves.toBeUndefined()

		expect(onResult).toHaveBeenLastCalledWith(null, null, expect.any(Error))
		expect(logger.error).toHaveBeenCalledTimes(1)
	})
})
