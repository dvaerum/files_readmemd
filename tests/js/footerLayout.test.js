// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { createContentRefresh } from '../../src/modules/contentRefresh.js'
import { applyFooterLayout } from '../../src/modules/footerLayout.js'

function footerFixture() {
	document.body.innerHTML = `
		<div class="files-list">
			<table>
				<tbody></tbody>
				<tfoot><tr></tr></tfoot>
			</table>
		</div>
	`
	return document.querySelector('.files-list')
}

describe('applyFooterLayout', () => {
	it('owns every inline footer layout mutation', () => {
		const container = footerFixture()

		applyFooterLayout(container)

		expect(container.style.getPropertyValue('overflow')).toBe('unset')
		for (const element of container.querySelectorAll(':scope > table > tbody, :scope > table > tfoot')) {
			expect(element.style.getPropertyValue('min-height')).toBe('unset')
		}
		for (const element of container.querySelectorAll(':scope > table > tfoot, :scope > table > tfoot > tr')) {
			expect(element.style.getPropertyValue('height')).toBe('65px')
		}
	})

	it('does nothing when the Mount adapter has no footer container', () => {
		expect(() => applyFooterLayout(null)).not.toThrow()
	})

	it('leaves footer layout untouched when a refresh fails', async () => {
		const container = footerFixture()
		const applyLayout = vi.fn(applyFooterLayout)
		const logger = { error: vi.fn() }
		const refresh = createContentRefresh({
			zone: 'footermd',
			config: {
				engines: { markdown: true, asciidoc: false, html: false },
				baseNames: { headermd: ['HEADER'], footermd: ['README'] },
				flags: {},
			},
			adapter: {
				directoryNames: async () => { throw new Error('listing failed') },
				downloadUrl: (file, path) => `${path}/${file}`,
			},
			load: vi.fn(),
			logger,
			onResult: (election, content) => {
				if (election !== null && content !== null) {
					applyLayout(container)
				}
			},
		})

		await expect(refresh('/docs')).resolves.toBeUndefined()

		expect(applyLayout).not.toHaveBeenCalled()
		expect(container.style.length).toBe(0)
	})
})
