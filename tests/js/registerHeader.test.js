// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { registerHeader } from '../../src/modules/registerHeader.js'

// Mirrors the v3.9 registry this app bundles; importing the real package under
// Vitest pulls in a CommonJS transitive dependency that cannot be named-imported.
vi.mock('@nextcloud/files', () => ({
	registerFileListHeaders: (header) => {
		globalThis._nc_filelistheader ??= []
		if (!globalThis._nc_filelistheader.some((entry) => entry.id === header.id)) {
			globalThis._nc_filelistheader.push(header)
		}
	},
}))

const header = {
	id: 'readmemd',
	order: 100,
	enabled: () => true,
	render: () => {},
	updated: () => {},
}

describe('registerHeader', () => {
	beforeEach(() => {
		delete globalThis._nc_files_scope
		delete globalThis._nc_filelistheader
	})

	it('registers with the legacy array when no scoped registry exists', () => {
		registerHeader(header)

		expect(globalThis._nc_filelistheader).toEqual([header])
	})

	it('does not add the same legacy header twice', () => {
		registerHeader(header)
		registerHeader(header)

		expect(globalThis._nc_filelistheader).toEqual([header])
	})

	it('registers with the scoped v4 registry and notifies an existing listener registry', () => {
		const dispatchEvent = vi.fn()
		globalThis._nc_files_scope = { v4_0: { registry: { dispatchEvent } } }

		registerHeader(header)

		expect(globalThis._nc_files_scope.v4_0.fileListHeaders.get('readmemd')).toBe(header)
		expect(dispatchEvent).toHaveBeenCalledWith(
			expect.objectContaining({ type: 'register:listHeader', detail: header }),
		)
	})

	it('also registers with the legacy array on scoped versions', () => {
		globalThis._nc_files_scope = { v4_0: {} }

		registerHeader(header)

		expect(globalThis._nc_filelistheader).toEqual([header])
		expect(globalThis._nc_files_scope.v4_0.fileListHeaders.get('readmemd')).toBe(header)
	})

	it('does not fail when the scope exists but the registry has not been created', () => {
		const scope = { v4_0: {} }
		globalThis._nc_files_scope = scope

		expect(() => registerHeader(header)).not.toThrow()
		expect(scope.v4_0.fileListHeaders.get('readmemd')).toBe(header)
	})
})
