import { describe, expect, it } from 'vitest'
import { decodeConfig } from '../../src/modules/configDecode.js'

describe('decodeConfig', () => {
	it('decodes the wire map into normalized engines, Base names and flags', () => {
		expect(decodeConfig({
			show_asciidoc: 'true',
			show_html: 'false',
			yellow_back: '1',
			show_title: 'off',
			auto_refresh: 'yes',
			disable_workspace: 'no',
			fileslist_header: ['HEADER', 'EXTRA'],
			fileslist_footer: ['README'],
		})).toEqual({
			engines: { markdown: true, asciidoc: true, html: false },
			baseNames: { headermd: ['HEADER', 'EXTRA'], footermd: ['README'] },
			flags: {
				yellowBack: true,
				showTitle: false,
				autoRefresh: true,
				disableWorkspace: false,
			},
		})
	})

	it('uses defaults for absent, malformed and legacy values', () => {
		expect(decodeConfig({
			show_asciidoc: 'maybe',
			yellow_back: 'on',
			fileslist_header: '{"not":"a list"}',
			fileslist_footer: [1],
			unknown_key: 'ignored',
		})).toEqual({
			engines: { markdown: true, asciidoc: false, html: false },
			baseNames: { headermd: ['HEADER'], footermd: ['README'] },
			flags: {
				yellowBack: true,
				showTitle: true,
				autoRefresh: false,
				disableWorkspace: true,
			},
		})
	})

	it('accepts legacy JSON array strings as well as wire arrays', () => {
		expect(decodeConfig({ fileslist_footer: '["FEATURES"]' }).baseNames.footermd)
			.toEqual(['FEATURES'])
	})

	it('keeps markdown enabled regardless of wire flags', () => {
		expect(decodeConfig({ show_markdown: 'false' }).engines.markdown).toBe(true)
	})

	it('returns a frozen normalized result', () => {
		const config = decodeConfig({ fileslist_header: ['HEADER'] })
		expect(Object.isFrozen(config)).toBe(true)
		expect(Object.isFrozen(config.engines)).toBe(true)
		expect(Object.isFrozen(config.baseNames)).toBe(true)
		expect(Object.isFrozen(config.baseNames.headermd)).toBe(true)
	})
})
