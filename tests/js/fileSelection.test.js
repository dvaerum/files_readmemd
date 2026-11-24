import { describe, expect, it } from 'vitest'
import { engineType, fileNamesForZone } from '../../src/utils/fileSelection.js'

const config = {
  show_asciidoc: 'false',
  show_html: 'false',
  fileslist_header: ['HEADER'],
  fileslist_footer: ['README'],
}

describe('engineType', () => {
  it('tolerates the initial state where no file has been elected yet', () => {
    expect(engineType(null, config)).toBe('Unsupported Engine')
  })

  it('always renders markdown and markdown-style files', () => {
    expect(engineType('README.md', config)).toBe('markdown')
    expect(engineType('README.markdown', config)).toBe('markdown')
  })

  it('gates asciidoc behind show_asciidoc', () => {
    expect(engineType('HEADER.adoc', config)).toBe('Unsupported Engine')
    expect(engineType('HEADER.asciidoc', config)).toBe('Unsupported Engine')
    expect(engineType('HEADER.adoc', { ...config, show_asciidoc: 'true' })).toBe('asciidoc')
  })

  it('gates html behind show_html and ignores other extensions', () => {
    expect(engineType('README.html', config)).toBe('Unsupported Engine')
    expect(engineType('README.htm', { ...config, show_html: 'true' })).toBe('html')
    expect(engineType('notes.txt', config)).toBe('Unsupported Engine')
  })
})

describe('fileNamesForZone', () => {
  it('uses the header list for the header zone and the footer list otherwise', () => {
    expect(fileNamesForZone('headermd', config)).toContain('HEADER.md')
    expect(fileNamesForZone('footermd', config)).toContain('README.md')
    expect(fileNamesForZone('headermd', config)).not.toContain('README.md')
    expect(fileNamesForZone('footermd', config)).not.toContain('HEADER.md')
  })

  it('matches the four markdown variants including dot-prefixed names', () => {
    expect(fileNamesForZone('footermd', config)).toEqual([
      'README.md', 'README.markdown', '.README.md', '.README.markdown',
    ])
  })

  it('adds asciidoc and html variants only when their flags are on', () => {
    const both = { ...config, show_asciidoc: 'true', show_html: 'true' }
    const names = fileNamesForZone('headermd', both)
    expect(names).toHaveLength(12)
    expect(names).toContain('HEADER.adoc')
    expect(names).toContain('.HEADER.asciidoc')
    expect(names).toContain('HEADER.htm')
    expect(names).toContain('.HEADER.html')
  })

  it('accumulates variants for every configured base name', () => {
    const two = { ...config, fileslist_footer: ['README', 'FOOTER'] }
    expect(fileNamesForZone('footermd', two)).toHaveLength(8)
    expect(fileNamesForZone('footermd', two)).toContain('FOOTER.md')
  })
})

// The election loop in Readmemd.vue lets the last matching candidate win.
// These assertions pin the ordering that makes hidden files and later base
// names win, so Phase 4 can move the policy without changing behaviour.
describe('characterization: election order', () => {
  it('puts hidden variants after visible ones', () => {
    const names = fileNamesForZone('footermd', config)
    expect(names.indexOf('.README.md')).toBeGreaterThan(names.indexOf('README.md'))
    expect(names[names.length - 1]).toBe('.README.markdown')
  })

  it('puts later base names after earlier ones', () => {
    const two = { ...config, fileslist_footer: ['README', 'FOOTER'] }
    const names = fileNamesForZone('footermd', two)
    expect(names.indexOf('FOOTER.md')).toBeGreaterThan(names.indexOf('README.md'))
    expect(names[names.length - 1]).toBe('.FOOTER.markdown')
  })
})
