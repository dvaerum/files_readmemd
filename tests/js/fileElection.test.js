import { describe, expect, it } from 'vitest'
import { electForZone } from '../../src/modules/fileElection.js'

const config = {
	show_asciidoc: 'false',
	show_html: 'false',
	fileslist_header: ['HEADER'],
	fileslist_footer: ['README'],
}

const elect = (zone, directoryNames, overrides = {}) => electForZone({
	zone,
	config: { ...config, ...overrides },
	directoryNames,
})

describe('electForZone', () => {
	it('lets a hidden markdown variant beat its visible counterpart', () => {
		expect(elect('headermd', ['HEADER.md', '.HEADER.md'])).toEqual({
			fileName: '.HEADER.md',
			engine: 'markdown',
			baseName: 'HEADER',
			hidden: true,
			reason: "hidden markdown variant of base 'HEADER'",
		})
	})

	it('elects a visible file when no hidden variant exists', () => {
		expect(elect('footermd', ['README.md'])).toEqual({
			fileName: 'README.md',
			engine: 'markdown',
			baseName: 'README',
			hidden: false,
			reason: "visible markdown variant of base 'README'",
		})
	})

	it('lets a later configured base beat an earlier hidden variant', () => {
		const names = ['README.md', '.README.md', 'FOOTER.md']
		const result = elect('footermd', names, { fileslist_footer: ['README', 'FOOTER'] })

		expect(result.fileName).toBe('FOOTER.md')
		expect(result.baseName).toBe('FOOTER')
		expect(result.hidden).toBe(false)
	})

	it('never elects candidates from disabled engines', () => {
		expect(elect('headermd', ['HEADER.adoc', 'HEADER.html'])).toBeNull()
		expect(elect('footermd', ['README.asciidoc', 'README.htm'])).toBeNull()
	})

	it('lets an enabled higher-ranked engine beat a hidden markdown variant', () => {
		const result = elect('headermd', ['.HEADER.md', 'HEADER.adoc'], {
			show_asciidoc: 'true',
		})

		expect(result.fileName).toBe('HEADER.adoc')
		expect(result.engine).toBe('asciidoc')
	})

	it('breaks same-engine ties by the later extension in the table', () => {
		expect(elect('footermd', ['README.md', 'README.markdown']).fileName).toBe('README.markdown')
		expect(elect('headermd', ['HEADER.adoc', 'HEADER.asciidoc'], {
			show_asciidoc: 'true',
		}).fileName).toBe('HEADER.asciidoc')
		expect(elect('footermd', ['README.htm', 'README.html'], {
			show_html: 'true',
		}).fileName).toBe('README.html')
	})

	it('lets a hidden variant beat a visible one for an optional engine too', () => {
		expect(elect('footermd', ['README.html', '.README.html'], {
			show_html: 'true',
		})).toEqual({
			fileName: '.README.html',
			engine: 'html',
			baseName: 'README',
			hidden: true,
			reason: "hidden html variant of base 'README'",
		})
	})

	it('returns null for an empty or unrelated directory', () => {
		expect(elect('footermd', [])).toBeNull()
		expect(elect('footermd', ['notes.txt', 'CHANGELOG.md'])).toBeNull()
	})

	it('fails loudly for an unknown zone instead of choosing a default', () => {
		expect(() => elect('sidermd', ['SIDER.md'])).toThrow(/unknown zone.*sidermd/)
	})
})
