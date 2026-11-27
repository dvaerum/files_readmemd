import { describe, expect, it } from 'vitest'
import { encodePath, encodePathSegment } from '../../src/modules/pathSegment.js'

describe('encodePathSegment', () => {
	it('encodes a Base name with multiple reserved characters into one segment', () => {
		expect(encodePathSegment('README?&/#+= %')).toBe('README%3F%26%2F%23%2B%3D%20%25')
	})

	it('encodes reserved sub-delimiters that encodeURIComponent leaves alone', () => {
		expect(encodePathSegment("it's (a) *test*!")).toBe('it%27s%20%28a%29%20%2Atest%2A%21')
	})

	it('keeps unreserved characters as they are', () => {
		expect(encodePathSegment('README-v2.0_final~md')).toBe('README-v2.0_final~md')
	})
})

describe('encodePath', () => {
	it('encodes each segment and leaves directory separators alone', () => {
		expect(encodePath('/docs/a?b#c/d&e')).toBe('/docs/a%3Fb%23c/d%26e')
	})

	it('preserves leading, trailing and repeated separators', () => {
		expect(encodePath('//docs//')).toBe('//docs//')
		expect(encodePath('')).toBe('')
	})
})
