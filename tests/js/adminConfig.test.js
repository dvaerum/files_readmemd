// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { axiosMock, loggerMock } = vi.hoisted(() => ({
	axiosMock: {
		post: vi.fn(async () => ({})),
		put: vi.fn(async () => ({})),
		delete: vi.fn(async () => ({})),
	},
	loggerMock: {
		debug: vi.fn(),
		error: vi.fn(),
	},
}))

vi.mock('@nextcloud/axios', () => ({ default: axiosMock }))
vi.mock('@nextcloud/router', () => ({ generateUrl: (url) => '/' + url }))
vi.mock('../../src/logger.js', () => ({ default: loggerMock }))

import { bindAdminConfig } from '../../src/modules/adminConfig.js'
import { zone, zoneIds } from '../../src/zones.js'

const click = (element) => element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

const listItem = (adminToken, fileName) => `
	<li class="readmeMD-filelist" id="readmeMD-filelist-${fileName}">
		<a data-zone="${adminToken}" data-filename="${fileName}" class="readmeMD-filelist_delete icon-delete"></a>${fileName}
	</li>`

function renderSettings() {
	const lists = zoneIds().map((id) => {
		const token = zone(id).adminToken
		const items = token === 'header' ? listItem(token, 'HEADER') : ''
		return `
			<ul id="readmeMD-filelist_${token}">${items}</ul>
			<input id="readmeMD-filelist_name-${token}" value="EXTRA-${token}">
			<a id="readmeMD-filelist_submit-${token}" class="button"></a>`
	}).join('')
	document.body.innerHTML = `
		<input type="checkbox" id="readmeMD-engine-asciidoc">
		<input type="checkbox" id="readmeMD-engine-html">
		<template id="readmeMD-filelist-row-template"><li class="readmeMD-filelist"><a class="readmeMD-filelist_delete icon-inline icon icon-delete"></a></li></template>
		${lists}`
}

describe('bindAdminConfig', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		renderSettings()
	})

	it('posts the AsciiDoc wire key and the checked value', async () => {
		const request = vi.fn(async () => ({}))
		bindAdminConfig(document, { request })

		click(document.getElementById('readmeMD-engine-asciidoc'))
		await flush()

		expect(request).toHaveBeenCalledTimes(1)
		const descriptor = request.mock.calls[0][0]
		expect(descriptor.method).toBe('post')
		expect(descriptor.url).toBe('/apps/files_readmemd/config')
		expect(descriptor.params.get('key')).toBe('show_asciidoc')
		expect(descriptor.params.get('value')).toBe('true')
	})

	it('posts the HTML wire key and the unchecked value', async () => {
		const request = vi.fn(async () => ({}))
		bindAdminConfig(document, { request })
		const checkbox = document.getElementById('readmeMD-engine-html')
		checkbox.checked = true

		click(checkbox)
		await flush()

		const descriptor = request.mock.calls[0][0]
		expect(descriptor.params.get('key')).toBe('show_html')
		expect(descriptor.params.get('value')).toBe('false')
	})

	it('maps both Zones to their declared endpoint segments for adds', async () => {
		const request = vi.fn(async () => ({}))
		bindAdminConfig(document, { request })

		for (const id of zoneIds()) {
			click(document.getElementById('readmeMD-filelist_submit-' + zone(id).adminToken))
		}
		await flush()

		expect(request.mock.calls.map(([descriptor]) => [descriptor.method, descriptor.url])).toEqual(
			zoneIds().map((id) => [
				'put',
				'/apps/files_readmemd/config/filenames/' + zone(id).endpointSegment + '/EXTRA-' + zone(id).adminToken,
			]),
		)
	})

	it('maps both Zones to their declared endpoint segments for removes', async () => {
		const request = vi.fn(async () => ({}))
		renderSettings()
		for (const id of zoneIds()) {
			const token = zone(id).adminToken
			document.getElementById('readmeMD-filelist_' + token)
				.insertAdjacentHTML('beforeend', listItem(token, 'REMOVE-' + token))
		}
		bindAdminConfig(document, { request })

		for (const id of zoneIds()) {
			click(document.querySelector('[data-filename="REMOVE-' + zone(id).adminToken + '"]'))
		}
		await flush()

		expect(request.mock.calls.map(([descriptor]) => [descriptor.method, descriptor.url])).toEqual(
			zoneIds().map((id) => [
				'delete',
				'/apps/files_readmemd/config/filenames/' + zone(id).endpointSegment + '/REMOVE-' + zone(id).adminToken,
			]),
		)
	})

	it('encodes a question mark in a base name endpoint', async () => {
		const request = vi.fn(async () => ({}))
		bindAdminConfig(document, { request })
		document.getElementById('readmeMD-filelist_name-footer').value = 'WHAT?'

		click(document.getElementById('readmeMD-filelist_submit-footer'))
		await flush()

		expect(request.mock.calls[0][0].url)
			.toBe('/apps/files_readmemd/config/filenames/footer/WHAT%3F')
	})

	it('appends a list item tagged with the Zone after a successful add', async () => {
		bindAdminConfig(document, { request: vi.fn(async () => ({})) })

		click(document.getElementById('readmeMD-filelist_submit-footer'))
		await flush()

		const added = document.querySelector('#readmeMD-filelist_footer [data-filename="EXTRA-footer"]')
		expect(added).not.toBeNull()
		expect(added.dataset.zone).toBe('footer')
		expect(added.parentNode.textContent).toContain('EXTRA-footer')
	})

	it('clones the row prototype instead of building its own markup', async () => {
		const prototypeLink = document
			.getElementById('readmeMD-filelist-row-template')
			.content.querySelector('a')
		prototypeLink.className = 'prototype-supplied-delete-class'
		bindAdminConfig(document, { request: vi.fn(async () => ({})) })

		click(document.getElementById('readmeMD-filelist_submit-footer'))
		await flush()

		const added = document.getElementById('readmeMD-filelist-EXTRA-footer')
		expect(added).not.toBeNull()
		expect(added.className).toBe('readmeMD-filelist')
		expect(added.querySelector('a').className).toBe('prototype-supplied-delete-class')
		expect(added.querySelector('a').dataset.zone).toBe('footer')
		expect(added.textContent).toContain('EXTRA-footer')
	})

	it('throws when the row prototype is missing', () => {
		document.getElementById('readmeMD-filelist-row-template').remove()

		expect(() => bindAdminConfig(document, { request: vi.fn(async () => ({})) }))
			.toThrow(/missing Base name row prototype/)
	})

	it('removes only the clicked item after a successful remove', async () => {
		document.getElementById('readmeMD-filelist_header')
			.insertAdjacentHTML('beforeend', listItem('header', 'SECOND'))
		bindAdminConfig(document, { request: vi.fn(async () => ({})) })

		click(document.querySelector('[data-filename="HEADER"]'))
		await flush()

		expect(document.getElementById('readmeMD-filelist-HEADER')).toBeNull()
		expect(document.getElementById('readmeMD-filelist-SECOND')).not.toBeNull()
	})

	it('delegates removal to list items added after binding', async () => {
		const request = vi.fn(async () => ({}))
		bindAdminConfig(document, { request })
		document.getElementById('readmeMD-filelist_header')
			.insertAdjacentHTML('beforeend', listItem('header', 'LATER'))

		click(document.querySelector('[data-filename="LATER"]'))
		await flush()

		expect(request.mock.calls[0][0].url).toBe('/apps/files_readmemd/config/filenames/header/LATER')
		expect(document.getElementById('readmeMD-filelist-LATER')).toBeNull()
	})

	it('logs a failed add and leaves the list unchanged', async () => {
		bindAdminConfig(document, { request: vi.fn(async () => { throw new Error('network') }) })

		await expect((async () => {
			click(document.getElementById('readmeMD-filelist_submit-footer'))
			await flush()
		})()).resolves.toBeUndefined()

		expect(loggerMock.error).toHaveBeenCalled()
		expect(document.querySelector('#readmeMD-filelist_footer [data-filename="EXTRA-footer"]')).toBeNull()
	})

	it('logs a failed remove and leaves the list unchanged', async () => {
		bindAdminConfig(document, { request: vi.fn(async () => { throw new Error('network') }) })

		click(document.querySelector('[data-filename="HEADER"]'))
		await flush()

		expect(loggerMock.error).toHaveBeenCalled()
		expect(document.getElementById('readmeMD-filelist-HEADER')).not.toBeNull()
	})

	it('logs a failed engine save without throwing to the DOM', async () => {
		bindAdminConfig(document, { request: vi.fn(async () => { throw new Error('network') }) })

		await expect((async () => {
			click(document.getElementById('readmeMD-engine-asciidoc'))
			await flush()
		})()).resolves.toBeUndefined()

		expect(loggerMock.error).toHaveBeenCalled()
	})

	it('uses axios as the default request adapter', async () => {
		bindAdminConfig(document)

		click(document.getElementById('readmeMD-engine-asciidoc'))
		click(document.getElementById('readmeMD-filelist_submit-header'))
		await flush()

		const [postUrl, params, options] = axiosMock.post.mock.calls[0]
		expect(postUrl).toBe('/apps/files_readmemd/config')
		expect(params.get('key')).toBe('show_asciidoc')
		expect(options.headers['Content-Type']).toBe('application/x-www-form-urlencoded; charset=UTF-8')
		expect(axiosMock.put).toHaveBeenCalledWith('/apps/files_readmemd/config/filenames/header/EXTRA-header')
	})
})
