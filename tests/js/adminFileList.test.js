// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { bindAdminFileListActions } from '../../src/modules/adminFileList.js'

const listItem = (zone, fileName) => `
	<li class="readmeMD-filelist" id="readmeMD-filelist-${fileName}">
		<a data-zone="${zone}" data-filename="${fileName}" class="readmeMD-filelist_delete icon-delete"></a>${fileName}
	</li>`

const renderSettings = () => {
	document.body.innerHTML = `
		<ul id="readmeMD-filelist_header">${listItem('header', 'HEADER')}</ul>
		<input id="readmeMD-filelist_name-header" value="EXTRA">
		<a id="readmeMD-filelist_submit-header" class="button"></a>
		<ul id="readmeMD-filelist_footer"></ul>
		<input id="readmeMD-filelist_name-footer" value="FEATURES">
		<a id="readmeMD-filelist_submit-footer" class="button"></a>`
}

const click = (element) => element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
const flush = async () => {
	await Promise.resolve()
	await Promise.resolve()
}

describe('bindAdminFileListActions', () => {
	beforeEach(() => {
		renderSettings()
		document.body.dataset.themes = 'default'
	})

	it('removes an existing base name through the injected action', async () => {
		const remove = vi.fn(async () => {})
		bindAdminFileListActions(document, { add: vi.fn(), remove })

		click(document.querySelector('[data-filename="HEADER"]'))
		await flush()

		expect(remove).toHaveBeenCalledWith({ zone: 'header', fileName: 'HEADER' })
		expect(document.getElementById('readmeMD-filelist-HEADER')).toBeNull()
	})

	it('delegates clicks for entries added after binding', async () => {
		const remove = vi.fn(async () => {})
		bindAdminFileListActions(document, { add: vi.fn(), remove })

		document.getElementById('readmeMD-filelist_header').insertAdjacentHTML('beforeend', listItem('header', 'LATER'))
		click(document.querySelector('[data-filename="LATER"]'))
		await flush()

		expect(remove).toHaveBeenCalledWith({ zone: 'header', fileName: 'LATER' })
		expect(document.getElementById('readmeMD-filelist-LATER')).toBeNull()
	})

	it('ignores clicks that are not on a delete button', async () => {
		const remove = vi.fn(async () => {})
		bindAdminFileListActions(document, { add: vi.fn(), remove })

		click(document.getElementById('readmeMD-filelist_header'))

		expect(remove).not.toHaveBeenCalled()
	})

	it('keeps the entry when the injected remove action fails', async () => {
		const remove = vi.fn(async () => { throw new Error('network') })
		bindAdminFileListActions(document, { add: vi.fn(), remove })

		click(document.querySelector('[data-filename="HEADER"]'))
		await flush()

		expect(document.getElementById('readmeMD-filelist-HEADER')).not.toBeNull()
	})

	it('adds a base name to the zone whose submit button was clicked', async () => {
		const add = vi.fn(async () => {})
		bindAdminFileListActions(document, { add, remove: vi.fn() })

		click(document.getElementById('readmeMD-filelist_submit-footer'))
		await flush()

		expect(add).toHaveBeenCalledWith({ zone: 'footer', fileName: 'FEATURES' })
		expect(document.getElementById('readmeMD-filelist-FEATURES')).not.toBeNull()
		const added = document.querySelector('#readmeMD-filelist_footer [data-filename="FEATURES"]')
		expect(added.dataset.zone).toBe('footer')
		expect(added.parentNode.textContent).toContain('FEATURES')
	})

	it('uses the promise-based axios contract through its callbacks', async () => {
		const requests = []
		const add = vi.fn(async (request) => { requests.push('put:' + request.zone + ':' + request.fileName) })
		const remove = vi.fn(async (request) => { requests.push('delete:' + request.zone + ':' + request.fileName) })
		bindAdminFileListActions(document, { add, remove })

		click(document.querySelector('[data-filename="HEADER"]'))
		click(document.getElementById('readmeMD-filelist_submit-footer'))
		await flush()

		expect(requests).toEqual(['delete:header:HEADER', 'put:footer:FEATURES'])
	})
})
