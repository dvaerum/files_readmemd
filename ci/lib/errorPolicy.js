'use strict'

// Explicit browser-console policy for known Nextcloud noise. Every rule names
// the message shape, the source that owns it, and the version where it was
// observed. Anything that does not match is an app error.

const RULES = [
  {
    id: 'core-csp-public-share',
    source: 'nextcloud-core',
    observedVersion: '29+',
    minMajor: 0,
    matches: (observation, context) =>
      /Content-Security-Policy|event\.preventDefault\(\)/.test(observation.message)
      && /\/s\/[^/]+/.test(context.url || ''),
  },
  {
    id: 'core-user-status-offline',
    source: 'nextcloud-core',
    observedVersion: '29+',
    minMajor: 0,
    matches: (observation) => /core: Failed to load user status(?::|\s)/.test(observation.message),
  },
  {
    id: 'core-recommendation-preview-offline',
    source: 'nextcloud-core',
    observedVersion: '33+',
    minMajor: 33,
    matches: (observation) => /could not load recommendation preview/i.test(observation.message),
  },
  {
    id: 'core-public-share-sw-registration',
    source: 'nextcloud-core',
    observedVersion: '33+',
    minMajor: 33,
    matches: (observation, context) =>
      /files: SW registration failed/.test(observation.message)
      && /\/s\/[^/]+/.test(context.url || ''),
  },
  {
    // The Text app tries to autosave an opened README on an unlocked public
    // share; the failure is core-side and does not affect the rendered zones.
    id: 'text-public-share-save-failure',
    source: 'nextcloud-text',
    observedVersion: '33+',
    minMajor: 33,
    matches: (observation, context) =>
      /^\[ERROR\] text: Failed to save document\./.test(observation.message)
      && /\/s\/[^/]+/.test(context.url || ''),
  },
  {
    // NC 33+ Text app logs the raw Error from its vendored Vue runtime when an
    // offline preview fails. The message alone is ambiguous; the source is not.
    id: 'text-vue-error-handler',
    source: 'nextcloud-text',
    observedVersion: '33+',
    minMajor: 33,
    matches: (observation) =>
      observation.message === 'Error'
      && /\/apps\/text\/js\/vue\.runtime\.esm-[^/?#]+\.chunk\.mjs(?:[?#]|$)/.test(observation.source),
  },
]

function majorVersion(version) {
  const match = /^(\d+)/.exec(version || '')
  return match ? Number(match[1]) : null
}

function applies(rule, context) {
  const major = majorVersion(context.version)
  return rule.minMajor === 0 || (major !== null && major >= rule.minMajor)
}

function observationOf(entry) {
  return typeof entry === 'string'
    ? { message: entry, source: '' }
    : { message: entry.message, source: entry.source || '' }
}

/**
 * Classify every observed console message. Ignored entries keep the source and
 * the rule that matched, so a reviewer can see why a message was not an error.
 */
function classifyErrors(messages, context = {}) {
  return messages.map((entry) => {
    const observation = observationOf(entry)
    const rule = RULES.find((candidate) => applies(candidate, context) && candidate.matches(observation, context))
    if (!rule) {
      return { ...observation, ignored: false, rule: null }
    }
    return {
      ...observation,
      ignored: true,
      rule: {
        id: rule.id,
        source: rule.source,
        observedVersion: rule.observedVersion,
      },
    }
  })
}

/**
 * Facade used by the specs: only unclassified app errors reach an assertion.
 */
function appErrors(observed, context = {}) {
  const messages = Array.isArray(observed) ? observed : observed.messages
  const rawContext = Array.isArray(observed) ? context : (observed.context || {})
  const resolvedContext = typeof rawContext === 'function' ? rawContext() : rawContext

  return classifyErrors(messages, resolvedContext)
    .filter((entry) => !entry.ignored)
    .map((entry) => entry.message)
}

module.exports = { classifyErrors, appErrors }
