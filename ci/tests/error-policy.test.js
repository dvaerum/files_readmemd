const assert = require('node:assert/strict')
const test = require('node:test')

const { appErrors, classifyErrors } = require('../lib/errorPolicy.js')

const filesPage = {
  version: '32-apache',
  state: 'default',
  url: 'http://localhost:8290/index.php/apps/files/',
}
const publicShare = {
  version: '32-apache',
  state: 'default',
  url: 'http://localhost:8290/s/share-token',
}
const nc33FilesPage = { ...filesPage, version: '33-apache' }
const nc33PublicShare = { ...publicShare, version: '33-apache' }
const textRuntime = 'http://localhost:8290/apps/text/js/vue.runtime.esm-CbNPNm8f.chunk.mjs'

const ruleMetadata = {
  'core-csp-public-share': {
    id: 'core-csp-public-share',
    source: 'nextcloud-core',
    observedVersion: '29+',
  },
  'core-user-status-offline': {
    id: 'core-user-status-offline',
    source: 'nextcloud-core',
    observedVersion: '29+',
  },
  'core-recommendation-preview-offline': {
    id: 'core-recommendation-preview-offline',
    source: 'nextcloud-core',
    observedVersion: '33+',
  },
  'text-vue-error-handler': {
    id: 'text-vue-error-handler',
    source: 'nextcloud-text',
    observedVersion: '33+',
  },
  'core-public-share-sw-registration': {
    id: 'core-public-share-sw-registration',
    source: 'nextcloud-core',
    observedVersion: '33+',
  },
  'text-public-share-save-failure': {
    id: 'text-public-share-save-failure',
    source: 'nextcloud-text',
    observedVersion: '33+',
  },
}

const cases = [
  {
    name: 'CSP message on the public share page is ignored',
    observed: 'Refused to load a resource because it violates Content-Security-Policy',
    context: publicShare,
    ignored: true,
    ruleId: 'core-csp-public-share',
  },
  {
    name: 'CSP callback message on the public share page is ignored',
    observed: 'TypeError: event.preventDefault() is not a function',
    context: publicShare,
    ignored: true,
    ruleId: 'core-csp-public-share',
  },
  {
    name: 'the same CSP message on a private page stays an app error',
    observed: 'Refused to load a resource because it violates Content-Security-Policy',
    context: filesPage,
    ignored: false,
  },
  {
    name: 'offline user-status noise is ignored',
    observed: 'core: Failed to load user status: fetch failed',
    context: filesPage,
    ignored: true,
    ruleId: 'core-user-status-offline',
  },
  {
    name: 'near-miss user-status text stays an app error',
    observed: 'core: Failed to load user statuses: fetch failed',
    context: filesPage,
    ignored: false,
  },
  {
    name: 'recommendation preview noise is ignored on NC 33',
    observed: 'could not load recommendation preview',
    context: nc33FilesPage,
    ignored: true,
    ruleId: 'core-recommendation-preview-offline',
  },
  {
    name: 'recommendation preview noise stays visible on NC 32',
    observed: 'could not load recommendation preview',
    context: filesPage,
    ignored: false,
  },
  {
    name: 'bare Error from the Text runtime is ignored on NC 33',
    observed: { message: 'Error', source: textRuntime },
    context: nc33FilesPage,
    ignored: true,
    ruleId: 'text-vue-error-handler',
  },
  {
    name: 'bare Error without the Text source stays an app error',
    observed: { message: 'Error', source: '' },
    context: nc33FilesPage,
    ignored: false,
  },
  {
    name: 'bare Error from a different Text chunk stays an app error',
    observed: { message: 'Error', source: 'http://localhost:8290/apps/text/js/other.chunk.mjs' },
    context: nc33FilesPage,
    ignored: false,
  },
  {
    name: 'bare Error from the Text runtime stays an app error on NC 32',
    observed: { message: 'Error', source: textRuntime },
    context: filesPage,
    ignored: false,
  },
  {
    name: 'near-miss recommendation text stays an app error',
    observed: 'could not load recommendations preview',
    context: nc33FilesPage,
    ignored: false,
  },
  {
    name: 'service worker registration noise is ignored on an NC 33 public share',
    observed: '[ERROR] files: SW registration failed:  JSHandle@object',
    context: nc33PublicShare,
    ignored: true,
    ruleId: 'core-public-share-sw-registration',
  },
  {
    name: 'service worker noise on a private page stays an app error',
    observed: '[ERROR] files: SW registration failed:  JSHandle@object',
    context: nc33FilesPage,
    ignored: false,
  },
  {
    name: 'Text autosave noise is ignored on an NC 33 public share',
    observed: '[ERROR] text: Failed to save document. JSHandle@object',
    context: nc33PublicShare,
    ignored: true,
    ruleId: 'text-public-share-save-failure',
  },
  {
    name: 'Text autosave noise on a private page stays an app error',
    observed: '[ERROR] text: Failed to save document. JSHandle@object',
    context: nc33FilesPage,
    ignored: false,
  },
  {
    name: 'a synthetic app error is the negative control',
    observed: 'pageerror: synthetic app failure',
    context: nc33FilesPage,
    ignored: false,
  },
]

for (const item of cases) {
  test(item.name, () => {
    const [entry] = classifyErrors([item.observed], item.context)

    assert.equal(entry.message, typeof item.observed === 'string' ? item.observed : item.observed.message)
    assert.equal(entry.ignored, item.ignored)
    if (item.ignored) {
      assert.deepEqual(entry.rule, ruleMetadata[item.ruleId])
    } else {
      assert.equal(entry.rule, null)
    }
  })
}

test('appErrors returns only messages the classifier did not ignore', () => {
  const noise = { message: 'Error', source: textRuntime }
  const synthetic = { message: 'pageerror: synthetic app failure', source: '' }
  const observed = {
    messages: [noise, synthetic],
    context: () => nc33FilesPage,
  }

  assert.deepEqual(appErrors(observed), [synthetic.message])
})
