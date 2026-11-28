// Browser selectors derived from the app's single zone declaration. The specs
// use CommonJS, so this module reads the same zones.json the app loads.
// setup_cmd copies it into ci/ for the Playwright container; outside CI, read
// the app-root original directly. Field validation belongs to the app's PHP
// and JS loaders, so this module only maps declared fields to selectors.

const fs = require('fs')
const path = require('path')

const source = path.resolve(__dirname, '../../zones.json')
const copied = path.resolve(__dirname, '../zones.json')
const declaration = require(fs.existsSync(source) ? source : copied)

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
  // The Zone wrapper and the rendered content both carry the zone class; the
  // custom element is the stable boundary for whole-zone screenshots.
  zoneElementSelector: (id) => `readmemd-zone.${zone(id).domClass}`,
  adminLinkSelector: (id, filename) =>
    `a[data-zone="${zone(id).adminToken}"][data-filename="${filename}"]`,
  configKey: (id) => zone(id).configKey,
  allDomSelector: () => Object.keys(declaration).map((id) => `.${zone(id).domClass}`).join(', '),
}
