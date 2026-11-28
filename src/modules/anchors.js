/**
 * @license AGPL-3.0-or-later
 *
 * The only DOM-specific seam left in the app. Nextcloud publishes a supported
 * mount element for file-list headers but no slot for footers or public shares,
 * so these anchors are probed once by capability name instead of being read as
 * a data source or spread across the adapters.
 */

const ANCHORS = {
	headermd: ['.files-list__header', '.filelist-header', '#app-content-vue', '#content-vue', 'main'],
	footermd: ['.files-list', '.filelist-footer', '#app-content-vue', '#content-vue', 'main'],
}

/**
 * @param {string} zoneId canonical zone id
 * @return {Element} first matching anchor, falling back to the body
 */
export function findAnchor(zoneId) {
	for (const selector of ANCHORS[zoneId] || []) {
		const element = document.querySelector(selector)
		if (element) {
			return element
		}
	}
	return document.body
}
