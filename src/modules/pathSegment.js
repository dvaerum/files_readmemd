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
 * One encoder for URL path segments. A Base name or directory name is one
 * segment; slashes belong to the path structure, so callers encode segments
 * separately. Encoding a whole path would hide that structure from the router.
 */

/**
 * @param {string} segment single path segment
 * @return {string} encoded segment safe inside a URL path
 */
export function encodePathSegment(segment) {
	return encodeURIComponent(String(segment))
		.replace(/[!'()*]/g, (character) => '%' + character.charCodeAt(0).toString(16).toUpperCase())
}

/**
 * @param {string} path slash-separated path
 * @return {string} path with every segment encoded and separators preserved
 */
export function encodePath(path) {
	return String(path).split('/').map(encodePathSegment).join('/')
}
