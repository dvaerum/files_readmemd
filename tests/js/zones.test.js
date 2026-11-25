import { describe, expect, it } from 'vitest'
import declaration from '../../zones.json'
import {
  hasAdminToken,
  hasZone,
  validateDeclaration,
  zone,
  zoneForAdminToken,
  zoneForConfigKey,
  zoneForDomClass,
  zoneForEndpointSegment,
  zoneIds,
} from '../../src/zones.js'
import ciZones from '../../ci/tests/zones.js'

describe('zone declaration', () => {
  it('exposes both zones with all four spellings and their response semantics', () => {
    expect(zoneIds()).toEqual(['headermd', 'footermd'])
    expect(zone('headermd')).toEqual({
      adminToken: 'header',
      configKey: 'fileslist_header',
      domClass: 'headermd',
      endpointSegment: 'header',
      responseSemantics: 'silent',
    })
    expect(zone('footermd').configKey).toBe('fileslist_footer')
    expect(zone('footermd').responseSemantics).toBe('success')
  })

  it('maps every field back to its zone', () => {
    expect(zoneForAdminToken('header')).toBe('headermd')
    expect(zoneForAdminToken('footer')).toBe('footermd')
    expect(zoneForConfigKey('fileslist_header')).toBe('headermd')
    expect(zoneForConfigKey('fileslist_footer')).toBe('footermd')
    expect(zoneForDomClass('headermd')).toBe('headermd')
    expect(zoneForDomClass('footermd')).toBe('footermd')
    expect(zoneForEndpointSegment('header')).toBe('headermd')
    expect(zoneForEndpointSegment('footer')).toBe('footermd')
    expect(hasZone('headermd')).toBe(true)
    expect(hasZone('sidermd')).toBe(false)
    expect(hasAdminToken('footer')).toBe(true)
    expect(hasAdminToken('side')).toBe(false)
  })

  it('rejects unknown zones and values instead of falling back', () => {
    expect(() => zone('sidermd')).toThrow(/unknown zone.*sidermd/)
    expect(() => zoneForDomClass('anywhere')).toThrow(/anywhere/)
    expect(() => zoneForConfigKey('fileslist_side')).toThrow(/fileslist_side/)
  })

  it('validates the declaration shape', () => {
    expect(() => validateDeclaration(declaration)).not.toThrow()
    expect(() => validateDeclaration([])).toThrow(/object/)
    expect(() => validateDeclaration({
      headermd: { adminToken: 'header', configKey: 'fileslist_header', domClass: 'headermd' },
    })).toThrow(/endpointSegment/)
    expect(() => validateDeclaration({
      headermd: {
        adminToken: 'header',
        configKey: 'fileslist_header',
        domClass: 'headermd',
        endpointSegment: '',
        responseSemantics: 'silent',
      },
    })).toThrow(/endpointSegment/)
    expect(() => validateDeclaration({
      headermd: {
        adminToken: 'header',
        configKey: 'fileslist_header',
        domClass: 'headermd',
        endpointSegment: 'header',
        responseSemantics: '',
      },
    })).toThrow(/responseSemantics/)
    expect(() => validateDeclaration({
      headermd: {
        adminToken: 'header',
        configKey: 'fileslist_header',
        domClass: 'headermd',
        endpointSegment: 'header',
        responseSemantics: 'silent',
      },
      footermd: {
        adminToken: 'footer',
        configKey: 'fileslist_header',
        domClass: 'footermd',
        endpointSegment: 'footer',
        responseSemantics: 'success',
      },
    })).toThrow(/fileslist_header/)
  })
})

describe('CI selectors derived from the declaration', () => {
  it('uses admin tokens for settings links and dom classes for rendered zones', () => {
    expect(ciZones.domSelector('headermd')).toBe('.headermd')
    expect(ciZones.adminLinkSelector('footermd', 'README')).toBe('a[data-zone="footer"][data-filename="README"]')
    expect(ciZones.configKey('headermd')).toBe('fileslist_header')
    expect(ciZones.allDomSelector()).toBe('.headermd, .footermd')
  })
})
