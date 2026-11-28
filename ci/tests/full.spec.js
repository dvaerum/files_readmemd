const { test, expect } = require('@playwright/test')
const {
  login,
  openFiles,
  watchErrors,
  appErrors,
  readAppConfig,
} = require('./helpers')
const ciZones = require('./zones')

const state = process.env.CI_STATE || 'default'
const FIXTURE_DIR = 'README-dev-fixtures'

test.describe(`files_readmemd visual matrix (${state})`, () => {
  test('settings page and config initial state @state=default', async ({ page }) => {
    const errors = watchErrors(page)
    await login(page)
    await page.goto('/index.php/settings/admin/files_readmemd')
    await page.locator('#readmeMD-engine').waitFor({ state: 'visible' })

    await expect(page.locator('#readmeMD-engine-asciidoc')).not.toBeChecked()
    await expect(page.locator('#readmeMD-engine-html')).not.toBeChecked()
    await expect(page.locator(ciZones.adminLinkSelector('headermd', 'HEADER'))).toBeVisible()
    await expect(page.locator(ciZones.adminLinkSelector('footermd', 'README'))).toBeVisible()

    const config = await readAppConfig(page)
    expect(config).toMatchObject({
      show_asciidoc: 'false',
      show_html: 'false',
      [ciZones.configKey('headermd')]: ['HEADER'],
      [ciZones.configKey('footermd')]: ['README'],
    })

    await expect(page.locator('#app-content')).toHaveScreenshot('settings-page.png')
    expect(appErrors(errors)).toEqual([])
  })

  test('Base name rows add and delete through the settings UI @state=default', async ({ page }) => {
    const errors = watchErrors(page)
    await login(page)
    await page.goto('/index.php/settings/admin/files_readmemd')
    await page.locator('#readmeMD-filelist-row-template').waitFor({ state: 'attached' })

    const name = 'RUNTIME-PROOF'
    const link = page.locator(ciZones.adminLinkSelector('footermd', name))
    try {
      await page.locator('#readmeMD-filelist_name-footer').fill(name)
      await page.locator('#readmeMD-filelist_submit-footer').click()
      await expect(link).toBeVisible()
      expect((await readAppConfig(page))[ciZones.configKey('footermd')]).toContain(name)

      await link.click()
      await expect(link).toHaveCount(0)
      expect((await readAppConfig(page))[ciZones.configKey('footermd')]).toEqual(['README'])
    } finally {
      if (await link.count()) {
        await link.click()
        await expect(link).toHaveCount(0)
      }
    }
    expect(appErrors(errors)).toEqual([])
  })

  test('markdown header and footer render @state=default', async ({ page }) => {
    const errors = watchErrors(page)
    await login(page)
    await openFiles(page, FIXTURE_DIR)

    const header = page.locator(ciZones.domSelector('headermd') + '[data-filename="HEADER.md"] .markdown-body')
    const footer = page.locator(ciZones.domSelector('footermd') + '[data-filename=".README.md"] .markdown-body')
    await header.waitFor({ state: 'visible' })
    await footer.waitFor({ state: 'visible' })
    await expect(header.locator('h1')).toHaveText('Fixture HEADER')
    await expect(footer.locator('h1')).toHaveText('Hidden README')

    await expect(header).toHaveScreenshot('header-markdown.png')
    await expect(footer).toHaveScreenshot('footer-markdown.png')
    expect(appErrors(errors)).toEqual([])
  })

  test('markdown feature structure @state=features', async ({ page }) => {
    const errors = watchErrors(page)
    await login(page)
    await openFiles(page, FIXTURE_DIR)

    const footer = page.locator(ciZones.domSelector('footermd') + '[data-filename="FEATURES.md"] .markdown-body')
    await footer.waitFor({ state: 'visible' })
    await expect(footer).toContainText('Heading one')

    expect(await footer.locator('h1, h2').count()).toBe(2)
    expect(await footer.locator('table').count()).toBe(1)
    expect(await footer.locator('input[type="checkbox"]').count()).toBe(2)
    expect(await footer.locator('pre code').count()).toBe(1)
    await expect(footer).toContainText('🎉')
    await expect(footer).toContainText('⚠️')

    await expect(footer).toHaveScreenshot('footer-features.png')
    expect(appErrors(errors)).toEqual([])
  })

  test('AsciiDoc and raw HTML engines @state=engines-on', async ({ page }) => {
    const errors = watchErrors(page)
    await login(page)
    await openFiles(page, FIXTURE_DIR)

    const header = page.locator(ciZones.domSelector('headermd') + '[data-filename="HEADER.adoc"] .paragraph strong')
    const footer = page.locator(ciZones.domSelector('footermd') + '[data-filename="README.html"] .html-body')
    await header.waitFor({ state: 'visible' })
    await footer.waitFor({ state: 'visible' })
    await expect(header).toHaveText('AsciiDoc')
    await expect(footer).toContainText('Fixture HTML footer')

    await expect(page.locator(ciZones.zoneElementSelector('headermd'))).toHaveScreenshot('header-asciidoc.png')
    await expect(page.locator(ciZones.zoneElementSelector('footermd'))).toHaveScreenshot('footer-html.png')
    expect(appErrors(errors)).toEqual([])
  })

  test('extra header and footer names @state=filelist-extra', async ({ page }) => {
    const errors = watchErrors(page)
    await login(page)
    await page.goto('/index.php/settings/admin/files_readmemd')

    await expect(page.locator(ciZones.adminLinkSelector('headermd', 'VISUALH'))).toBeVisible()
    await expect(page.locator(ciZones.adminLinkSelector('footermd', 'VISUALF'))).toBeVisible()

    await expect(page.locator('#app-content')).toHaveScreenshot('settings-extra-names.png')
    expect(appErrors(errors)).toEqual([])
  })

  test('subfolder switches footer @state=default', async ({ page }) => {
    const errors = watchErrors(page)
    await login(page)
    await openFiles(page, `${FIXTURE_DIR}/subfolder`)

    const footer = page.locator(ciZones.domSelector('footermd') + '[data-filename="README.md"] .markdown-body')
    await footer.waitFor({ state: 'visible' })
    await expect(footer.locator('h1')).toHaveText('Subfolder README')
    await expect(footer).toHaveScreenshot('footer-subfolder.png')
    expect(appErrors(errors)).toEqual([])
  })

  test('public share renders both zones @state=default', async ({ page }) => {
    const token = process.env.SHARE_TOKEN
    expect(token, 'SHARE_TOKEN must be provided by ci/run.sh').toBeTruthy()

    const errors = watchErrors(page)
    await page.goto(`/s/${token}`)
    // NC 33 removed the old #isPublic input; the share heading is stable.
    await expect(page.getByRole('heading', { name: 'Public share', level: 1 })).toBeVisible()

    const header = page.locator(ciZones.domSelector('headermd') + '[data-filename="HEADER.md"] .markdown-body')
    const footer = page.locator(ciZones.domSelector('footermd') + '[data-filename=".README.md"] .markdown-body')
    await header.waitFor({ state: 'visible' })
    await footer.waitFor({ state: 'visible' })

    await expect(header).toHaveScreenshot('share-header.png')
    await expect(footer).toHaveScreenshot('share-footer.png')
    expect(appErrors(errors)).toEqual([])
  })
})
