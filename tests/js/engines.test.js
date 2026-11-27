import { describe, expect, it } from 'vitest'
import declaration from '../../engines.json'
import {
  adminControlId,
  configurableEngineIds,
  engine,
  engineForAdminControlId,
  engineForExtension,
  engineForWireKey,
  engineIds,
  hasEngine,
  hasExtension,
  isAlwaysOn,
  rank,
  validateDeclaration,
  wireDefault,
  wireKey,
} from '../../src/engines.js'

const markdown = {
  extensions: ['md', 'markdown'],
  wireKey: null,
  wireDefault: true,
  alwaysOn: true,
  adminControlId: 'readmeMD-engine-markdown',
}
const asciidoc = {
  extensions: ['adoc', 'asciidoc'],
  wireKey: 'show_asciidoc',
  wireDefault: false,
  alwaysOn: false,
  adminControlId: 'readmeMD-engine-asciidoc',
}

describe('engine declaration', () => {
  it('exposes every Render engine in declaration order with its facts', () => {
    expect(engineIds()).toEqual(['markdown', 'asciidoc', 'html'])
    expect(engine('markdown')).toEqual(markdown)
    expect(engine('asciidoc').extensions).toEqual(['adoc', 'asciidoc'])
    expect(wireKey('html')).toBe('show_html')
    expect(wireDefault('html')).toBe(false)
    expect(isAlwaysOn('markdown')).toBe(true)
    expect(isAlwaysOn('asciidoc')).toBe(false)
    expect(adminControlId('html')).toBe('readmeMD-engine-html')
  })

  it('derives engine rank and wire keys from the declaration', () => {
    expect(configurableEngineIds()).toEqual(['asciidoc', 'html'])
    expect(rank('markdown')).toBe(1)
    expect(rank('asciidoc')).toBe(2)
    expect(rank('html')).toBe(3)
  })

  it('maps every derived value back to its engine', () => {
    expect(engineForWireKey('show_asciidoc')).toBe('asciidoc')
    expect(engineForWireKey('show_html')).toBe('html')
    expect(engineForAdminControlId('readmeMD-engine-markdown')).toBe('markdown')
    expect(engineForExtension('htm')).toBe('html')
    expect(engineForExtension('asciidoc')).toBe('asciidoc')
    expect(hasExtension('markdown')).toBe(true)
    expect(hasExtension('txt')).toBe(false)
    expect(hasEngine('html')).toBe(true)
    expect(hasEngine('sidecar')).toBe(false)
  })

  it('rejects unknown engines and values instead of falling back', () => {
    expect(() => engine('sidecar')).toThrow(/unknown engine.*sidecar/)
    expect(() => engineForWireKey('show_sidecar')).toThrow(/show_sidecar/)
    expect(() => engineForExtension('txt')).toThrow(/txt/)
  })

  it('validates the declaration shape', () => {
    expect(() => validateDeclaration(declaration)).not.toThrow()
    expect(() => validateDeclaration([])).toThrow(/object/)
    expect(() => validateDeclaration({})).toThrow(/no engines/)
    expect(() => validateDeclaration({ '': markdown })).toThrow(/empty engine id/)
    expect(() => validateDeclaration({ markdown: { ...markdown, wireKey: undefined } }))
      .toThrow(/wireKey/)
    expect(() => validateDeclaration({ markdown: { ...markdown, extensions: [] } }))
      .toThrow(/extensions/)
    expect(() => validateDeclaration({ markdown: { ...markdown, extensions: ['md', 'md'] } }))
      .toThrow(/duplicate.*md/)
    expect(() => validateDeclaration({ markdown, asciidoc: { ...asciidoc, extensions: ['md'] } }))
      .toThrow(/duplicate.*md/)
    expect(() => validateDeclaration({
      markdown,
      asciidoc: { ...asciidoc, adminControlId: markdown.adminControlId },
    })).toThrow(/readmeMD-engine-markdown/)
    expect(() => validateDeclaration({ asciidoc: { ...asciidoc, wireKey: null } }))
      .toThrow(/wireKey/)
    expect(() => validateDeclaration({
      markdown,
      asciidoc: { ...asciidoc, wireKey: 'show_markdown' },
      html: {
        extensions: ['htm', 'html'],
        wireKey: 'show_markdown',
        wireDefault: false,
        alwaysOn: false,
        adminControlId: 'readmeMD-engine-html',
      },
    })).toThrow(/show_markdown/)
  })
})
