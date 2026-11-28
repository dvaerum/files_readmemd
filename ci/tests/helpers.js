const { expect } = require('@playwright/test')
const { appErrors: filterAppErrors } = require('../lib/errorPolicy.js')

const ADMIN_USER = process.env.NC_ADMIN_USER || 'admin'
const ADMIN_PASSWORD = process.env.NC_ADMIN_PASSWORD || 'admin-password-please-change-me'

async function login(page) {
  await page.goto('/index.php/login')
  // The login label differs across versions ("Login with username or email"
  // on 29, "Account name or email" on 33+); the input name is stable.
  await page.locator('input[name="user"], input#user').first().fill(ADMIN_USER)
  await page.locator('input[type="password"]').first().fill(ADMIN_PASSWORD)
  await page.getByRole('button', { name: /^log in$/i }).click()
  await page.waitForURL(/\/apps\/dashboard\//, { timeout: 30_000 })
  await expect(page.locator('#firstrunwizard')).toHaveCount(0)
}

async function openFiles(page, dir) {
  // Nextcloud requires an absolute path in ?dir=; a relative name reports
  // "Folder not found" even though the WebDAV folder exists.
  const absolute = dir && !dir.startsWith('/') ? `/${dir}` : dir
  const query = absolute ? `?dir=${encodeURIComponent(absolute)}` : ''
  await page.goto(`/index.php/apps/files/${query}`)
  // Newer Files versions use #content-vue; older ones use #app-content.
  await page.locator('#content-vue, #app-content, #app-content-files').first().waitFor({ state: 'visible' })
}

function watchErrors(page) {
  const messages = []
  page.on('console', (message) => {
    if (message.type() === 'error') {
      messages.push({ message: message.text(), source: message.location().url || '' })
    }
  })
  page.on('pageerror', (error) => messages.push({ message: `pageerror: ${error.message}`, source: '' }))
  // Context is read at assertion time: the page navigates after this watcher
  // is installed, so its final URL is the one that scopes the CSP rule.
  return {
    messages,
    context: () => ({
      version: process.env.NEXTCLOUD_VERSION || 'unknown',
      state: process.env.CI_STATE || 'default',
      url: page.url(),
    }),
  }
}

// Facade kept at every spec call site; the tested policy lives in lib/.
function appErrors(observed) {
  return filterAppErrors(observed)
}

// Configuration is read-only in the browser and travels as initial state on
// Files pages, not on the settings page being inspected. A throwaway page in
// the same context observes writes without navigating the page under test.
async function readAppConfig(page) {
  const probe = await page.context().newPage()
  try {
    await probe.goto('/index.php/apps/files/')
    const node = probe.locator('#initial-state-files_readmemd-config')
    await node.waitFor({ state: 'attached' })
    return await probe.evaluate(() => {
      const element = document.getElementById('initial-state-files_readmemd-config')
      return JSON.parse(atob(element.value))
    })
  } finally {
    await probe.close()
  }
}

module.exports = {
  ADMIN_USER,
  ADMIN_PASSWORD,
  login,
  openFiles,
  watchErrors,
  appErrors,
  readAppConfig,
}
