// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { createDav } from '../../src/modules/dav.js'

function harness() {
	const client = {
		getDirectoryContents: vi.fn(async () => [
			{ type: 'file', basename: 'README.md' },
			{ type: 'dir', basename: 'subfolder' },
			{ type: 'file', basename: 'HEADER.md' },
		]),
		getFileContents: vi.fn(async () => '# hello'),
	}
	return {
		client,
		dav: createDav({
			client,
			root: '/files/user',
			remote: 'https://cloud.example.org/remote.php/dav',
		}),
	}
}

describe('createDav', () => {
	it('lists only files below the encoded directory path', async () => {
		const { dav, client } = harness()

		expect(await dav.directoryNames('/docs/a?b#c')).toEqual(['README.md', 'HEADER.md'])
		expect(client.getDirectoryContents).toHaveBeenCalledWith('/files/user/docs/a%3Fb%23c')
	})

	it('loads content as text with an encoded file name', async () => {
		const { dav, client } = harness()

		expect(await dav.loadContent('README? #.md', '/docs')).toBe('# hello')
		expect(client.getFileContents).toHaveBeenCalledWith(
			'/files/user/docs/README%3F%20%23.md',
			{ format: 'text' },
		)
	})

	it('keeps absolute markdown links absolute when resolving URLs', () => {
		const { dav } = harness()

		expect(dav.linkUrl('image.png', '/docs')).toBe(
			'https://cloud.example.org/remote.php/dav/files/user/docs/image.png',
		)
		expect(dav.linkUrl('/guide.md', '/docs')).toBe(
			'https://cloud.example.org/remote.php/dav/files/user/guide.md',
		)
	})
})
