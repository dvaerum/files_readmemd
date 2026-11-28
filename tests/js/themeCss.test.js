import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('../../css/readmemd.css', import.meta.url), 'utf8')

describe('the single readmemd stylesheet', () => {
	it('owns the footer layout without inline style mutations', () => {
		expect(css).toContain('.files-list:has(+ readmemd-zone.footermd)')
		expect(css).toContain('height: 65px')
		expect(css).toContain('min-height: unset')
	})

	it('maps markdown colours onto Nextcloud theming variables', () => {
		expect(css).toContain('--fgColor-accent: var(--color-primary')
		expect(css).toContain('--borderColor-default: var(--color-border')
		expect(css).toContain('color: var(--color-main-text')
	})

	it('covers both dark-mode signals', () => {
		expect(css).toContain('@media (prefers-color-scheme: dark)')
		expect(css).toContain("[data-themes^='dark'] readmemd-zone")
	})
})
