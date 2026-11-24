// Browser selectors derived from the app's single zone declaration. The specs
// use CommonJS, so this module reads the same zones.json the app loads.
// setup_cmd copies it into ci/ for the Playwright container; outside CI, read
// the app-root original directly.

const fs = require('fs')
const path = require('path')

const source = path.resolve(__dirname, '../../zones.json')
const copied = path.resolve(__dirname, '../zones.json')
const declaration = require(fs.existsSync(source) ? source : copied)

const FIELDS = ['adminToken', 'configKey', 'domClass', 'endpointSegment']

function validate(candidate) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    throw new Error('zone declaration must be an object')
  }
  const seen = {}
  for (const [id, zone] of Object.entries(candidate)) {
    if (!zone || typeof zone !== 'object' || Array.isArray(zone)) {
      throw new Error(`zone '${id}' must be an object`)
    }
    for (const field of FIELDS) {
      const value = zone[field]
      if (typeof value !== 'string' || value.trim() === '') {
        throw new Error(`zone '${id}' must define a non-empty string '${field}'`)
      }
      if (seen[field] && seen[field][value]) {
        throw new Error(`duplicate '${field}' value '${value}' in zone declaration`)
      }
      seen[field] = { ...seen[field], [value]: true }
    }
  }
  return candidate
}

validate(declaration)

function zone(id) {
  if (!Object.prototype.hasOwnProperty.call(declaration, id)) {
    throw new Error(`unknown zone '${id}'`)
  }
  return declaration[id]
}

module.exports = {
  zone,
  zoneIds: () => Object.keys(declaration),
  domSelector: (id) => `.${zone(id).domClass}`,
  adminLinkSelector: (id, filename) =>
    `a[data-zone="${zone(id).adminToken}"][data-filename="${filename}"]`,
  configKey: (id) => zone(id).configKey,
  allDomSelector: () => Object.keys(declaration).map((id) => `.${zone(id).domClass}`).join(', '),
}
