const { test, expect } = require('@playwright/test')
const { login, openFiles, watchErrors, appErrors } = require('./helpers')
const ciZones = require('./zones')

const state = process.env.CI_STATE || 'default'
const expected = process.env.CI_APP_EXPECTED || 'disabled'
const FIXTURE_DIR = 'README-dev-fixtures'

test.describe(`Nextcloud compatibility (${state}, app ${expected})`, () => {
  test(`files page matches the declared support range @state=${state}`, async ({ page }) => {
    const errors = watchErrors(page)
    await login(page)

    if (expected === 'enabled') {
      await openFiles(page, FIXTURE_DIR)
      const header = page.locator(`${ciZones.domSelector('headermd')}[data-filename="HEADER.md"] .markdown-body`)
      const footer = page.locator(`${ciZones.domSelector('footermd')}[data-filename=".README.md"] .markdown-body`)
      await header.waitFor({ state: 'visible' })
      await footer.waitFor({ state: 'visible' })
      await expect(header.locator('h1')).toHaveText('Fixture HEADER')
      await expect(footer.locator('h1')).toHaveText('Hidden README')
    } else {
      // The negative control has no fixture upload; compare the stock root.
      await openFiles(page)
      await expect(page.locator(ciZones.allDomSelector())).toHaveCount(0)
    }

    await expect(page.locator('#content-vue, #app-content').first()).toHaveScreenshot('files-page.png')
    expect(appErrors(errors)).toEqual([])
  })
})
