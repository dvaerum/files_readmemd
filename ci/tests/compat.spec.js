const { test, expect } = require('@playwright/test')
const { login, openFiles, watchErrors, appErrors } = require('./helpers')

const state = process.env.CI_STATE || 'compat'

test.describe(`Nextcloud compatibility (${state})`, () => {
  test(`stock UI renders without the app @state=${state}`, async ({ page }) => {
    const errors = watchErrors(page)
    await login(page)
    await openFiles(page)

    // On NC 33+ the app declares max-version 29, so it must not be loadable.
    await expect(page.locator('.headermd, .footermd')).toHaveCount(0)
    await expect(page.locator('#content-vue, #app-content').first()).toHaveScreenshot('files-page.png')
    expect(appErrors(errors)).toEqual([])
  })
})
