// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HEADER_ID, createHeaderDescriptor, registerHeader } from '../../src/modules/registerHeader.js'

const registerFileListHeader = vi.fn()
vi.mock('@nextcloud/files', () => ({ registerFileListHeader: (...args) => registerFileListHeader(...args) }))

describe('supported header registration', () => {
	beforeEach(() => {
		registerFileListHeader.mockClear()
		delete globalThis._nc_files_scope
		delete globalThis._nc_filelistheader
	})

	it('registers one descriptor through the public API', () => {
		const descriptor = createHeaderDescriptor({ render: () => {}, updated: () => {} })

		registerHeader(descriptor)

		expect(registerFileListHeader).toHaveBeenCalledTimes(1)
		expect(registerFileListHeader).toHaveBeenCalledWith(descriptor)
		expect(descriptor.id).toBe(HEADER_ID)
		expect(descriptor.order).toBe(100)
		expect(descriptor.enabled()).toBe(true)
	})

	it('never writes a scoped global or a legacy window array', () => {
		registerHeader(createHeaderDescriptor({ render: () => {}, updated: () => {} }))

		expect(globalThis._nc_files_scope).toBeUndefined()
		expect(globalThis._nc_filelistheader).toBeUndefined()
	})

	it('passes the lifecycle callbacks straight through', () => {
		const render = vi.fn()
		const updated = vi.fn()
		const descriptor = createHeaderDescriptor({ render, updated })

		descriptor.render('el', 'folder', 'view')
		descriptor.updated('folder', 'view')

		expect(render).toHaveBeenCalledWith('el', 'folder', 'view')
		expect(updated).toHaveBeenCalledWith('folder', 'view')
	})
})
