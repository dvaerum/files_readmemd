<?php
/**
 * @author Matthieu Le Corre <matthieu.lecorre@univ-nantes.fr>
 *
 * @license GNU AGPL version 3 or any later version
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

/** @var $l \OCP\IL10N */
/** @var $_ array */

style("files_readmemd","admin") ;
?>

<form id="readmeMD-filelist" class="section" >
    <h2> <?php p($l->t("Files list")) ; ?>
    </h2>

    <p class="settings-hint">
		<?php p($l->t("Choose the name of the files which will be used as HEADER/FOOTER content,")) ;?>
		<br>
		<?php p($l->t("Enter basename without file extensions :")) ;?>
	</p>

	<?php echo $_['view']->render(); ?>
</form>
