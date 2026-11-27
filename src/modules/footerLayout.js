/**
 * @license AGPL-3.0-or-later
 *
 * This program is free software: you can redistribute it and/or modify it under
 * the terms of the GNU Affero General Public License as published by the Free
 * Software Foundation, either version 3 of the License, or (at your option)
 * any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * Footer layout behind the Mount seam. The view owns when to call this module;
 * the module owns every inline mutation. Mount reattaches the same container
 * node, so these styles survive a folder change without being reapplied.
 */

/**
 * Apply the inline layout needed to show a rendered footer table.
 *
 * @param {Element|null} container footer container from the Mount adapter
 * @return {void}
 */
export function applyFooterLayout(container) {
	if (!container) {
		return
	}

	container.style.setProperty('overflow', 'unset')

	for (const element of container.querySelectorAll(':scope > table > tbody, :scope > table > tfoot')) {
		element.style.setProperty('min-height', 'unset')
	}

	for (const element of container.querySelectorAll(':scope > table > tfoot, :scope > table > tfoot > tr')) {
		element.style.setProperty('height', '65px')
	}
}
