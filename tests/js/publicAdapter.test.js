// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPublicAdapter } from '../../src/adapters/publicShare.js'

const modernDom = () => `
	<div id="content-vue">
		<main id="app-content-vue">
			<h1 class="hidden-visually">Public share</h1>
			<div class="files-list__header files-list__header--public"></div>
			<div class="files-list" data-cy-files-list>
				<table class="files-list__table">
					<tbody class="files-list__tbody">
						<tr data-cy-files-list-row data-cy-files-list-row-name="subfolder">
							<td><span class="folder-icon"></span></td>
						</tr>
						<tr data-cy-files-list-row data-cy-files-list-row-name="HEADER.md"><td></td></tr>
						<tr data-cy-files-list-row data-cy-files-list-row-name=".README.md"><td></td></tr>
					</tbody>
				</table>
			</div>
		</main>
	</div>`

const setUrl = (path) => window.history.pushState({}, '', path)

describe('createPublicAdapter on modern public shares', () => {
	beforeEach(() => {
		delete globalThis.OCA
		// Nextcloud always sets an explicit webroot; without it the router would
		// derive "/s" from the share URL and produce a broken download path.
		window._oc_webroot = ''
		globalThis.OC = { config: { modRewriteWorking: true } }
		document.body.innerHTML = modernDom()
		setUrl('/s/modern-token')
		vi.useRealTimers()
	})

	it('waits for file-list rows before reporting readiness', async () => {
		document.body.innerHTML = '<div class="files-list__header"></div>'
		vi.useFakeTimers()
		const adapter = createPublicAdapter()
		let resolved = false
		const ready = adapter.whenReady().then(() => { resolved = true })

		await vi.advanceTimersByTimeAsync(1000)
		expect(resolved).toBe(false)

		document.body.innerHTML = modernDom()
		await vi.advanceTimersByTimeAsync(1000)
		await ready
		expect(resolved).toBe(true)
		vi.useRealTimers()
	})

	it('reads names from the visible rows and the path from the URL', async () => {
		const adapter = createPublicAdapter()
		await adapter.whenReady()

		expect(await adapter.directoryNames('/')).toEqual(['HEADER.md', '.README.md'])
		expect(adapter.currentPath()).toBe('')

		setUrl('/s/modern-token?dir=%2Fsubfolder')
		expect(adapter.currentPath()).toBe('/subfolder')
	})

	it('derives the share token from the URL when the legacy input is absent', async () => {
		const adapter = createPublicAdapter()
		setUrl('/s/modern-token?dir=%2Fsubfolder')

		expect(adapter.downloadUrl('HEADER.md', '/subfolder')).toBe(
			'/s/modern-token/download?path=%2Fsubfolder&files=HEADER.md',
		)
		expect(adapter.linkUrl('image.png', '/subfolder')).toBe(
			'/s/modern-token/download?path=%2Fsubfolder&files=image.png',
		)
	})

	it('mounts after the modern header and list containers', () => {
		const adapter = createPublicAdapter()
		const header = adapter.mountPoint({ adminToken: 'header', domClass: 'headermd' })
		const footer = adapter.mountPoint({ adminToken: 'footer', domClass: 'footermd' })

		expect(header.parent.className).toContain('files-list__header')
		expect(header.position).toBe('after')
		expect(header.existing).toBeNull()
		expect(footer.parent.className).toContain('files-list')
		expect(footer.position).toBe('after')
		expect(footer.existing).toBeNull()
		expect(adapter.footerContainer()).toBe(document.querySelector('.files-list'))
	})

	it('follows URL path changes', async () => {
		vi.useFakeTimers()
		const adapter = createPublicAdapter()
		const callback = vi.fn()
		const unsubscribe = adapter.onPathChange(callback)

		setUrl('/s/modern-token?dir=%2Fsubfolder')
		await vi.advanceTimersByTimeAsync(1000)
		expect(callback).toHaveBeenCalledWith('/subfolder')

		unsubscribe()
		setUrl('/s/modern-token')
		await vi.advanceTimersByTimeAsync(1000)
		expect(callback).toHaveBeenCalledTimes(1)
		vi.useRealTimers()
	})
})
