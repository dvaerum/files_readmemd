// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { axiosMock } = vi.hoisted(() => ({
	axiosMock: {
		post: vi.fn(async () => ({})),
		put: vi.fn(async () => ({})),
		delete: vi.fn(async () => ({})),
	},
}))

vi.mock('@nextcloud/axios', () => ({ default: axiosMock }))
vi.mock('@nextcloud/router', () => ({ generateUrl: (url) => '/' + url }))

import '../../src/config.js'

const click = (element) => element.dispatchEvent(new MouseEvent('click', { bubbles: true }))

describe('admin config wiring', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		document.body.innerHTML = `
			<input type="checkbox" id="readmeMD-engine-asciidoc">
			<input type="checkbox" id="readmeMD-engine-html">
			<ul id="readmeMD-filelist_header">
				<li class="readmeMD-filelist" id="readmeMD-filelist-HEADER">
					<a data-zone="header" data-filename="HEADER" class="readmeMD-filelist_delete"></a>HEADER
				</li>
			</ul>
			<input id="readmeMD-filelist_name-header" value="EXTRA">
			<a id="readmeMD-filelist_submit-header"></a>
			<ul id="readmeMD-filelist_footer"></ul>
			<input id="readmeMD-filelist_name-footer" value="FEATURES">
			<a id="readmeMD-filelist_submit-footer"></a>`
		document.dispatchEvent(new Event('DOMContentLoaded'))
	})

	it('posts engine changes with the promise-based axios API', () => {
		const checkbox = document.getElementById('readmeMD-engine-asciidoc')
		checkbox.click()

		expect(axiosMock.post).toHaveBeenCalledTimes(1)
		const [url, params] = axiosMock.post.mock.calls[0]
		expect(url).toBe('/apps/files_readmemd/config')
		expect(params.get('key')).toBe('show_asciidoc')
		expect(params.get('value')).toBe('true')
	})

	it('maps admin tokens to the declared endpoint segment for deletes', async () => {
		click(document.querySelector('[data-filename="HEADER"]'))
		await Promise.resolve()

		expect(axiosMock.delete).toHaveBeenCalledWith('/apps/files_readmemd/config/filenames/header/HEADER')
	})

	it('maps admin tokens to the declared endpoint segment for adds', async () => {
		click(document.getElementById('readmeMD-filelist_submit-footer'))
		await Promise.resolve()

		expect(axiosMock.put).toHaveBeenCalledWith('/apps/files_readmemd/config/filenames/footer/FEATURES')
	})
})
