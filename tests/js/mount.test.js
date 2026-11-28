// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createMount } from '../../src/modules/mount.js'
import { createPrivateAdapter, privateFooterLayout } from '../../src/adapters/privateFiles.js'
import { createPublicAdapter } from '../../src/adapters/publicShare.js'

vi.mock('@nextcloud/sharing/public', () => ({
	getSharingToken: () => 'fake-token',
	isPublicShare: () => true,
}))

vi.mock('../../src/view/Readmemd.vue', async () => {
	const { h, onMounted, ref, watch } = await import('vue')
	return {
		default: {
			name: 'Readmemd',
			props: {
				fileListAdapter: { type: Object, required: true },
				zone: { type: String, required: true },
				path: { type: String, default: '' },
			},
			setup(props, { expose }) {
				const names = ref([])
				const currentPath = ref(props.path)
				const update = async (path) => {
					currentPath.value = path
					names.value = await props.fileListAdapter.directoryNames(path)
				}
				expose({ update })
				watch(() => props.path, update)
				onMounted(() => update(props.path))
				return { names, currentPath }
			},
			render() {
				return h('div', {
					class: this.zone,
					'data-path': this.currentPath,
					'data-names': this.names.join(','),
				})
			},
		},
	}
})

const flush = async () => {
	for (let i = 0; i < 3; i += 1) {
		await Promise.resolve()
		await nextTick()
	}
}

const fakeAdapter = (overrides = {}) => {
	let onPath
	return {
		mode: 'private',
		whenReady: vi.fn(() => Promise.resolve()),
		currentPath: vi.fn(() => '/start'),
		directoryNames: vi.fn(async () => ['README.md']),
		loadContent: vi.fn(async (file, path) => `content:${path}/${file}`),
		linkUrl: vi.fn((link, path) => `/link${path}/${link}`),
		mountPoint: vi.fn((definition) => ({
			parent: () => document.querySelector(definition.adminToken === 'header' ? '#header-slot' : '.files-list'),
			position: 'append',
			existing: null,
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
		<div class="files-list__header"></div>
		<div class="files-list"></div>`
}

const fakeDav = (names = ['README.md']) => ({
	directoryNames: vi.fn(async () => names),
	loadContent: vi.fn(async (file, path) => `content:${path}/${file}`),
	linkUrl: vi.fn((link, path) => `/remote${path}/${link}`),
})

describe('createMount', () => {
	beforeEach(() => {
		resetDom()
	})

	it('mounts one custom element into the supported header slot', async () => {
		const adapter = fakeAdapter({
			mountPoint: () => ({ parent: () => document.querySelector('#header-slot'), position: 'append' }),
		})
		const mount = createMount({ zone: 'headermd', fileListAdapter: adapter, path: '/root' })
		await flush()

		const wrapper = document.querySelector('readmemd-zone.headermd')
		expect(wrapper.dataset.zone).toBe('headermd')
		expect(wrapper.querySelector('.headermd').dataset.path).toBe('/root')
		expect(document.querySelector('#header-slot > readmemd-zone')).toBe(wrapper)

		mount.destroy()
	})

	it('reattaches on a path change when the slot node was replaced', async () => {
		const adapter = fakeAdapter({
			mountPoint: () => ({ parent: () => document.querySelector('#header-slot'), position: 'append' }),
		})
		const mount = createMount({ zone: 'headermd', fileListAdapter: adapter, path: '/root' })
		await flush()
		const wrapper = document.querySelector('readmemd-zone.headermd')

		document.querySelector('#header-slot').remove()
		const replacement = document.createElement('div')
		replacement.id = 'header-slot'
		document.body.appendChild(replacement)

		mount.update('/subfolder')
		await flush()

		expect(document.querySelector('#header-slot > readmemd-zone')).toBe(wrapper)
		expect(wrapper.querySelector('.headermd').dataset.path).toBe('/subfolder')
		expect(document.querySelectorAll('readmemd-zone.headermd')).toHaveLength(1)
		mount.destroy()
	})

	it('reuses and replaces an existing zone node', async () => {
		const parent = document.querySelector('.files-list')
		const existing = document.createElement('div')
		existing.className = 'footermd'
		parent.appendChild(existing)
		const adapter = fakeAdapter({
			mountPoint: () => ({ parent, position: 'append', existing }),
		})

		const mount = createMount({ zone: 'footermd', fileListAdapter: adapter, path: '/root' })
		await flush()

		expect(document.querySelectorAll('div.footermd')).toHaveLength(1)
		expect(existing.isConnected).toBe(false)
		expect(document.querySelector('readmemd-zone.footermd > .footermd')).not.toBeNull()
		mount.destroy()
	})

	it('subscribes to path changes and removes its node on destroy', async () => {
		const adapter = fakeAdapter()
		const mount = createMount({ zone: 'headermd', fileListAdapter: adapter, path: '/root' })
		await flush()

		adapter.triggerPath('/polled')
		await flush()
		expect(document.querySelector('readmemd-zone.headermd .headermd').dataset.path).toBe('/polled')

		mount.destroy()
		expect(document.querySelector('readmemd-zone')).toBeNull()
		expect(adapter.unsubscribeCount()).toBe(true)

		adapter.triggerPath('/after-destroy')
		expect(adapter.directoryNames).toHaveBeenCalledTimes(2)
	})
})

describe('private adapter', () => {
	it('uses the DAV seam and resolves a lazy footer parent', async () => {
		const dav = fakeDav(['README.md'])
		const parent = document.querySelector('.files-list')
		const adapter = createPrivateAdapter(
			{ parent: () => parent, position: 'after' },
			{ dav, path: '/docs' },
		)

		expect(adapter.mode).toBe('private')
		expect(adapter.currentPath()).toBe('/docs')
		await expect(adapter.whenReady()).resolves.toBeUndefined()
		expect(await adapter.directoryNames('/docs')).toEqual(['README.md'])
		expect(await adapter.loadContent('README.md', '/docs')).toBe('content:/docs/README.md')
		expect(adapter.linkUrl('image.png', '/docs')).toBe('/remote/docs/image.png')

		const point = adapter.mountPoint({ id: 'footermd', domClass: 'footermd' })
		expect(point.parent).toBe(parent)
		expect(point.position).toBe('after')
		expect(adapter.onPathChange(() => {})()).toBeUndefined()

		adapter.setPath('/next')
		expect(adapter.currentPath()).toBe('/next')
	})

	it('probes the shared anchor for the footer', () => {
		const adapter = createPrivateAdapter({ parent: null, position: 'after' })
		expect(adapter.mountPoint({ domClass: 'footermd' }).parent).toBeNull()

		const footer = privateFooterLayout('footermd')
		expect(footer.parent()).toBe(document.querySelector('.files-list'))
		expect(footer.position).toBe('after')
	})
})

describe('public adapter', () => {
	beforeEach(() => {
		document.body.innerHTML = `
			<div class="files-list__header"></div>
			<div class="files-list"><table class="files-list__table"></table></div>`
		window.history.pushState({}, '', '/s/fake-token')
	})

	it('mounts the same zone shape as the private adapter', async () => {
		const dav = fakeDav(['README.md'])
		const adapter = createPublicAdapter({ dav })
		const privateAdapter = createPrivateAdapter(
			{ parent: () => document.querySelector('.files-list'), position: 'append' },
			{ dav },
		)
		const snapshot = async (candidate) => {
			const mounts = ['headermd', 'footermd'].map((zoneId) => createMount({
				zone: zoneId,
				fileListAdapter: candidate,
				path: '/',
			}))
			await flush()
			const result = ['headermd', 'footermd'].map((zoneId) => {
				const node = document.querySelector(`readmemd-zone.${zoneId} .${zoneId}`)
				return { zoneId, names: node.dataset.names, path: node.dataset.path }
			})
			mounts.forEach((mount) => mount.destroy())
			return result
		}

		expect(await snapshot(adapter)).toEqual(await snapshot(privateAdapter))
		expect(adapter.token()).toBe('fake-token')
	})
})
