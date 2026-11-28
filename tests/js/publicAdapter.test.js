// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPublicAdapter } from '../../src/adapters/publicShare.js'

vi.mock('@nextcloud/sharing/public', () => ({
	getSharingToken: () => globalThis.__shareToken ?? 'fake-token',
	isPublicShare: () => globalThis.__isPublicShare !== false,
}))

const shareDom = () => `
	<div id="content-vue">
		<main id="app-content-vue">
			<div class="files-list__header files-list__header--public"></div>
			<div class="files-list" data-cy-files-list><table class="files-list__table"></table></div>
		</main>
	</div>`

const setUrl = (path) => window.history.pushState({}, '', path)

function fakeDav() {
	return {
		directoryNames: vi.fn(async () => ['HEADER.md', '.README.md']),
		loadContent: vi.fn(async (file) => `content:${file}`),
		linkUrl: vi.fn((link, path) => `/share${path}/${link}`),
	}
}

describe('createPublicAdapter on modern public shares', () => {
	beforeEach(() => {
		document.body.innerHTML = shareDom()
		setUrl('/s/fake-token')
		delete globalThis.__shareToken
		delete globalThis.__isPublicShare
		vi.useRealTimers()
	})

	it('waits for the share view before reporting readiness', async () => {
		document.body.innerHTML = '<div id="app-content-vue"></div>'
		vi.useFakeTimers()
		const adapter = createPublicAdapter({ dav: fakeDav() })
		let resolved = false
		const ready = adapter.whenReady().then(() => { resolved = true })

		await vi.advanceTimersByTimeAsync(1000)
		expect(resolved).toBe(false)

		document.body.innerHTML = shareDom()
		await vi.advanceTimersByTimeAsync(1000)
		await ready
		expect(resolved).toBe(true)
		vi.useRealTimers()
	})

	it('gives up waiting when no share view appears', async () => {
		document.body.innerHTML = '<div id="app-content-vue"></div>'
		vi.useFakeTimers()
		const adapter = createPublicAdapter({ dav: fakeDav() })

		const ready = adapter.whenReady()
		const assertion = expect(ready).rejects.toThrow('Public share view did not become ready')
		await vi.advanceTimersByTimeAsync(15000)
		await assertion
		vi.useRealTimers()
	})

	it('reads the directory from the URL and ignores legacy sharing globals', async () => {
		globalThis.OCA = { Sharing: { PublicApp: { fileList: { _currentDirectory: '/wrong' } } } }
		const dav = fakeDav()
		const adapter = createPublicAdapter({ dav })

		await expect(adapter.whenReady()).resolves.toBeUndefined()
		expect(adapter.currentPath()).toBe('')
		setUrl('/s/fake-token?dir=%2Fsubfolder')
		expect(adapter.currentPath()).toBe('/subfolder')
		expect(await adapter.directoryNames('/subfolder')).toEqual(['HEADER.md', '.README.md'])
		expect(dav.directoryNames).toHaveBeenCalledWith('/subfolder')
		delete globalThis.OCA
	})

	it('takes the token from the supported sharing helper', () => {
		const adapter = createPublicAdapter({ dav: fakeDav() })

		expect(adapter.token()).toBe('fake-token')
		globalThis.__shareToken = 'other-token'
		expect(adapter.token()).toBe('other-token')
		globalThis.__isPublicShare = false
		expect(adapter.token()).toBe('')
	})

	it('mounts beside the probed header and list anchors', () => {
		const adapter = createPublicAdapter({ dav: fakeDav() })
		const header = adapter.mountPoint({ adminToken: 'header', domClass: 'headermd' })
		const footer = adapter.mountPoint({ adminToken: 'footer', domClass: 'footermd' })

		expect(header.parent()).toBe(document.querySelector('.files-list__header'))
		expect(header.position).toBe('after')
		expect(header.existing).toBeNull()
		expect(footer.parent()).toBe(document.querySelector('.files-list'))
		expect(footer.position).toBe('after')
	})

	it('follows URL path changes until unsubscribed', async () => {
		vi.useFakeTimers()
		const adapter = createPublicAdapter({ dav: fakeDav() })
		const callback = vi.fn()
		const unsubscribe = adapter.onPathChange(callback)

		setUrl('/s/fake-token?dir=%2Fsubfolder')
		await vi.advanceTimersByTimeAsync(1000)
		expect(callback).toHaveBeenCalledWith('/subfolder')

		unsubscribe()
		setUrl('/s/fake-token?dir=%2Fother')
		await vi.advanceTimersByTimeAsync(1000)
		expect(callback).toHaveBeenCalledTimes(1)
		vi.useRealTimers()
	})
})
