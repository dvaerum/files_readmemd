// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Vue from 'vue'
import { createMount } from '../../src/modules/mount.js'
import { createPrivateAdapter } from '../../src/adapters/privateFiles.js'
import { createPublicAdapter } from '../../src/adapters/publicShare.js'

vi.mock('../../src/view/Readmemd.vue', () => ({
	default: {
		name: 'Readmemd',
		props: {
			fileListAdapter: {
				type: Object,
				required: true,
			},
		},
		data() {
			return { names: [] }
		},
		mounted() {
			this.$watch('path', async () => {
				this.names = await this.fileListAdapter.directoryNames(this.path)
			}, { immediate: true })
		},
		render(h) {
			return h('div', {
				class: this.zone,
				attrs: {
					'data-path': this.path,
					'data-names': this.names.join(','),
					'data-download': this.fileListAdapter.downloadUrl('README.md', this.path),
				},
			})
		},
	},
}))

const flush = async () => {
	await Promise.resolve()
	await Vue.nextTick()
	await Promise.resolve()
	await Vue.nextTick()
}

const fakeAdapter = (overrides = {}) => {
	let onPath
	return {
		mode: 'private',
		whenReady: vi.fn(() => Promise.resolve()),
		currentPath: vi.fn(() => '/start'),
		directoryNames: vi.fn(async () => ['README.md']),
		downloadUrl: vi.fn((fileName, path) => `/download${path}/${fileName}`),
		linkUrl: vi.fn((link, path) => `/link${path}/${link}`),
		footerContainer: vi.fn(() => document.querySelector('.files-list')),
		mountPoint: vi.fn((definition) => ({
			parent: document.querySelector(definition.adminToken === 'header'
				? '.filelist-header'
				: '.filelist-footer'),
			position: 'append',
		})),
		onPathChange: vi.fn((callback) => {
			onPath = callback
			return () => { onPath = undefined }
		}),
		triggerPath: (path) => onPath && onPath(path),
		unsubscribeCount: () => onPath === undefined,
		...overrides,
	}
}

const resetDom = () => {
	document.body.innerHTML = `
		<div id="header-slot"></div>
		<div class="filelist-header"></div>
		<div class="files-list"></div>
		<div class="filelist-footer"></div>
		<input type="hidden" id="sharingToken" value="fake-token">
	`
}

describe('createMount', () => {
	beforeEach(() => {
		resetDom()
		vi.useRealTimers()
	})

	it('reattaches a zone when its container is replaced before an update', async () => {
		const adapter = fakeAdapter({
			mountPoint: (definition) => ({
				parent: () => document.querySelector(definition.adminToken === 'header' ? '#header-slot' : '.files-list'),
				position: 'append',
			}),
		})
		const mount = createMount({
			zone: 'headermd',
			fileListAdapter: adapter,
			path: '/root',
		})
		await flush()
		expect(document.querySelector('#header-slot .headermd')).not.toBeNull()

		document.getElementById('header-slot').remove()
		const replacement = document.createElement('div')
		replacement.id = 'header-slot'
		document.body.appendChild(replacement)

		mount.update('/subfolder')
		await flush()
		expect(document.querySelector('#header-slot .headermd').dataset.path).toBe('/subfolder')
		expect(document.querySelectorAll('.headermd')).toHaveLength(1)
	})

	it('reattaches when a Vue host replaces the node without an update', async () => {
		const adapter = fakeAdapter({
			mountPoint: (definition) => ({
				parent: () => document.querySelector(definition.adminToken === 'header' ? '#header-slot' : '.files-list'),
				position: 'append',
			}),
		})
		const mount = createMount({
			zone: 'footermd',
			fileListAdapter: adapter,
			path: '/root',
		})
		await flush()
		document.querySelector('.footermd').parentElement.remove()

		await flush()
		expect(document.querySelector('.files-list .footermd')).not.toBeNull()

		mount.destroy()
		await flush()
		expect(document.querySelector('.footermd')).toBeNull()
	})

	it('gets names from the adapter and re-renders when the path changes', async () => {
		const adapter = fakeAdapter()
		const mount = createMount({
			zone: 'footermd',
			fileListAdapter: adapter,
			path: '/root',
		})
		await flush()

		expect(adapter.directoryNames).toHaveBeenCalledWith('/root')
		expect(document.querySelector('.footermd').dataset.names).toBe('README.md')

		mount.update('/subfolder')
		await flush()

		expect(document.querySelector('.footermd').dataset.path).toBe('/subfolder')
		expect(adapter.directoryNames).toHaveBeenCalledWith('/subfolder')
	})

	it('subscribes to path changes and removes its node on destroy', async () => {
		const adapter = fakeAdapter()
		const mount = createMount({
			zone: 'headermd',
			fileListAdapter: adapter,
			path: '/root',
		})
		await flush()

		adapter.triggerPath('/polled')
		await flush()
		expect(document.querySelector('.headermd').dataset.path).toBe('/polled')

		mount.destroy()
		expect(document.querySelector('.headermd')).toBeNull()
		expect(adapter.unsubscribeCount()).toBe(true)

		adapter.triggerPath('/after-destroy')
		expect(document.querySelector('.headermd')).toBeNull()
	})

	it('reuses an existing zone node instead of duplicating it', () => {
		const parent = document.querySelector('.filelist-footer')
		const existing = document.createElement('div')
		existing.className = 'footermd'
		parent.appendChild(existing)

		const adapter = fakeAdapter({
			mountPoint: () => ({ parent, position: 'append', existing }),
		})
		const mount = createMount({
			zone: 'footermd',
			fileListAdapter: adapter,
			path: '/root',
		})

		expect(document.querySelectorAll('.footermd')).toHaveLength(1)
		mount.destroy()
	})
})

describe('real adapters', () => {
	beforeEach(() => {
		resetDom()
		globalThis.OC = {
			linkToRemoteBase: vi.fn((path) => `/remote.php/dav/${path}`),
		}
	})

	it('private adapter resolves a lazy parent function and an after position', () => {
		const view = { getContents: async () => ({ contents: [] }) }
		const adapter = createPrivateAdapter(view, {
			parent: () => document.querySelector('.files-list'),
			position: 'after',
		})
		const point = adapter.mountPoint({ adminToken: 'footer', domClass: 'footermd' })

		expect(point.parent).toBe(document.querySelector('.files-list'))
		expect(point.position).toBe('after')
	})

	it('private adapter normalizes file contents and uses the private download URL', async () => {
		const view = {
			getContents: vi.fn(async () => ({
				contents: [
					{ type: 'file', basename: 'README.md' },
					{ type: 'dir', basename: 'subfolder' },
				],
			})),
		}
		const adapter = createPrivateAdapter(view, {
			parent: document.querySelector('#header-slot'),
			position: 'append',
		})

		expect(adapter.mode).toBe('private')
		expect(await adapter.directoryNames('/README-dev-fixtures')).toEqual(['README.md'])
		expect(adapter.downloadUrl('README.md', '/dir')).toBe('/remote.php/dav/files/dir/README.md')
		expect(adapter.linkUrl('image.png', '/dir')).toBe('/remote.php/dav/files/dir/image.png')
		expect(adapter.footerContainer()).toBe(document.querySelector('.files-list'))
		expect(adapter.mountPoint({ adminToken: 'header', domClass: 'headermd' }).parent.id).toBe('header-slot')
		adapter.onPathChange(() => {})()
	})

	it('private adapter encodes path and Base name segments but keeps link URL semantics', () => {
		const adapter = createPrivateAdapter(
			{ getContents: async () => ({ contents: [] }) },
			{ parent: document.querySelector('#header-slot'), position: 'append' },
		)

		expect(adapter.downloadUrl('README?&/#+= %.md', '/docs/a?b#c/d'))
			.toBe('/remote.php/dav/files/docs/a%3Fb%23c/d/README%3F%26%2F%23%2B%3D%20%25.md')
		expect(adapter.linkUrl('image.png?version=2#preview', '/dir'))
			.toBe('/remote.php/dav/files/dir/image.png?version=2#preview')
	})

	it('public adapter normalizes share files and uses the share download URL', async () => {
		globalThis.OCA = {
			Sharing: {
				PublicApp: {
					fileList: {
						files: [
							{ type: 'file', name: '.README.md' },
							{ type: 'dir', name: 'subfolder' },
						],
						_currentDirectory: '/',
					},
				},
			},
		}
		const adapter = createPublicAdapter()

		await adapter.whenReady()
		expect(adapter.mode).toBe('public')
		expect(adapter.currentPath()).toBe('/')
		expect(await adapter.directoryNames('/')).toEqual(['.README.md'])
		expect(adapter.downloadUrl('.README.md', '/')).toBe('//index.php/s/fake-token/download?path=%2F&files=.README.md')
		expect(adapter.linkUrl('image.png', '/')).toBe('//index.php/s/fake-token/download?path=%2F&files=image.png')
		expect(adapter.footerContainer()).toBeNull()
		expect(adapter.mountPoint({ adminToken: 'footer', domClass: 'footermd' }).parent.className).toBe('filelist-footer')
		adapter.onPathChange(() => {})()
	})

	it('private and public adapters mount the same zone DOM', async () => {
		const snapshot = async (adapter) => {
			const header = createMount({ zone: 'headermd', fileListAdapter: adapter, path: '/' })
			const footer = createMount({ zone: 'footermd', fileListAdapter: adapter, path: '/' })
			await flush()
			const result = ['headermd', 'footermd'].map((name) => {
				const node = document.querySelector('.' + name)
				return { name, names: node.dataset.names, path: node.dataset.path }
			})
			header.destroy()
			footer.destroy()
			return result
		}

		const privateView = { getContents: async () => ({ contents: [{ type: 'file', basename: 'README.md' }] }) }
		const privateDom = await snapshot(createPrivateAdapter(privateView, {
			parent: document.querySelector('#header-slot'),
			position: 'append',
		}))

		resetDom()
		globalThis.OCA = {
			Sharing: {
				PublicApp: {
					fileList: {
						files: [{ type: 'file', name: 'README.md' }],
						_currentDirectory: '/',
					},
				},
			},
		}
		const publicDom = await snapshot(createPublicAdapter())

		expect(publicDom).toEqual(privateDom)
	})
})
