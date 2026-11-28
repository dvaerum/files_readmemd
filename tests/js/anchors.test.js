// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { findAnchor } from '../../src/modules/anchors.js'

describe('findAnchor', () => {
	beforeEach(() => {
		document.body.innerHTML = ''
	})

	it('probes the supported header slot before the page', () => {
		document.body.innerHTML = '<main id="app-content-vue"><div class="files-list__header"></div></main>'

		expect(findAnchor('headermd')).toBe(document.querySelector('.files-list__header'))
		expect(findAnchor('footermd')).toBe(document.querySelector('#app-content-vue'))
	})

	it('falls back to the body when no named anchor exists', () => {
		expect(findAnchor('headermd')).toBe(document.body)
		expect(findAnchor('unknown-zone')).toBe(document.body)
	})
})
