const { expect } = require('@playwright/test')

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
    if (message.type() === 'error') messages.push(message.text())
  })
  page.on('pageerror', (error) => messages.push(`pageerror: ${error.message}`))
  return messages
}

// Core Nextcloud emits CSP errors on the public-share page and a user-status
// fetch error in offline containers. Neither comes from this app; everything
// else must be clean.
function appErrors(messages) {
  return messages.filter(
    (message) =>
      !/Content-Security-Policy|event\.preventDefault\(\)/.test(message) &&
      !/core: Failed to load user status/.test(message) &&
      // NC 33+ logs a bare "Error" from its offline recommendation preview.
      !/could not load recommendation preview/.test(message) &&
      message !== 'Error',
  )
}

async function readAppConfig(page) {
  return page.evaluate(async () => {
    const response = await fetch('/apps/files_readmemd/config', {
      headers: { requesttoken: window.OC.requestToken },
    })
    if (!response.ok) throw new Error(`config API returned ${response.status}`)
    return response.json()
  })
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
