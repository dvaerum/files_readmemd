import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const src = (name) => readFileSync(new URL('../../src/' + name, import.meta.url), 'utf8')

describe('frontend regressions found during live verification', () => {
  it('does not use the removed axios .success() callback', () => {
    const config = src('config.js')
    expect(config).not.toMatch(/\.success\s*\(/)
    expect(config).toContain("import logger from './logger.js'")
  })

  it('delegates delete clicks so newly added filenames are removable', () => {
    const config = src('config.js')
    expect(config).toContain("addEventListener('click'")
    expect(config).toContain(".closest('.readmeMD-filelist_delete')")
  })

  it('has no stale computer: option in the markdown engine', () => {
    const markdown = src('components/MarkdownEngine.vue')
    expect(markdown).not.toMatch(/\bcomputer\s*:/)
    expect(markdown).toContain('created()')
  })

  it('declares and passes the mode prop used by the asciidoc engine', () => {
    const asciidoc = src('components/AsciidocEngine.vue')
    expect(asciidoc).toMatch(/props:\s*\{[\s\S]*\bmode\s*:/)

    const readmemd = src('view/Readmemd.vue')
    expect(readmemd).toMatch(/<AsciidocEngine[\s\S]*?:mode="mode"/)
  })
})
