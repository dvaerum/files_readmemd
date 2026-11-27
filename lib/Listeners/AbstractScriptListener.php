<?php
/**
 * @author 2024 Matthieu Le Corre <matthieu.lecorre@univ-nantes.fr>
 *
 * @license GNU AGPL version 3 or any later version
 *
 * This program is free software: you can redistribute it and/or modify it under
 * the terms of the GNU Affero General Public License as
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
 *
 */

namespace OCA\ReadmeMD\Listeners;

use OCA\ReadmeMD\Services\Config;
use OCP\AppFramework\Services\IInitialState;
use OCP\EventDispatcher\Event;
use OCP\EventDispatcher\IEventListener;
use OCP\Util;

/**
 * Shared implementation for script listeners.
 *
 * Concrete listeners supply only their SCRIPT_ASSET. The addScript method is
 * the substitution seam; handle() owns the call order and the wire snapshot.
 */
abstract class AbstractScriptListener implements IEventListener
{
    private Config $config;
    private IInitialState $initialState;

    public function __construct(Config $config, IInitialState $initialState)
    {
        $this->config = $config;
        $this->initialState = $initialState;
    }

    public function handle(Event $event): void
    {
        $this->addScript('files_readmemd', static::SCRIPT_ASSET);
        $this->initialState->provideInitialState(
            'config',
            $this->config->snapshot()->toWireArray()
        );
    }

    /**
     * Register the script with Nextcloud. Kept as a seam so tests can assert
     * the asset without booting the server.
     */
    protected function addScript(string $app, string $script): void
    {
        Util::addscript($app, $script);
    }
}
