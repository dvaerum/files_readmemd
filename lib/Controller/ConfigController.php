<?php
/**
 * @author 2019 Matthieu Le Corre <matthieu.lecorre@univ-nantes.fr>
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
 *
 */

namespace OCA\ReadmeMD\Controller ;

use OCP\AppFramework\Controller  ;
use OCA\ReadmeMD\Services\Config ;
use OCP\IRequest;

class ConfigController extends Controller {

    private Config $config;

    public function __construct($AppName, IRequest $request, Config $config ) {
        parent::__construct($AppName, $request);

        $this->config = $config;
    }

    /**
     * @NoAdminRequired
     * @PublicPage
     */
    public function getConfig() {
        return $this->config->snapshot()->toWireArray();
    }

    public function setConfig($key, $value) {
        $key = (string) $key;
        $this->config->setWireValue($key, (string) $value);

        return $this->config->wireValue($key);
    }

    public function removeFileName($file, $zone) {
        if (!$this->config->isKnownZone((string) $zone)) {
            return null;
        }
        $this->config->removeZoneBaseName((string) $zone, (string) $file);
    }

    public function addFileName ($file, $zone) {
        if (!$this->config->isKnownZone((string) $zone)) {
            return null;
        }
        $this->config->addZoneBaseName((string) $zone, (string) $file);

        if ($zone === 'footer') {
            return 'success' ;
        }
    }

}
