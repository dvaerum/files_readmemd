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

namespace OCA\ReadmeMD\Controller;

use OCA\ReadmeMD\Services\Config;
use OCA\ReadmeMD\View\NextcloudZoneAdminRenderer;
use OCA\ReadmeMD\View\ZoneAdminView;
use OCP\AppFramework\Http;
use OCP\AppFramework\Http\DataResponse;
use OCP\AppFramework\OCSController;
use OCP\IRequest;
use OCP\IL10N;

/**
 * Admin writes only. Reads travel with the page as initial state, so there is
 * no public GET endpoint to expose configuration.
 */
class ConfigController extends OCSController
{
    private Config $config;
    private ZoneAdminView $adminView;

    public function __construct($AppName, IRequest $request, Config $config, IL10N $l)
    {
        parent::__construct($AppName, $request);

        $this->config = $config;
        $this->adminView = new ZoneAdminView(
            $config->snapshot(),
            new NextcloudZoneAdminRenderer($l)
        );
    }

    public function setConfig($key, $value): DataResponse
    {
        $key = (string) $key;
        $this->config->setWireValue($key, (string) $value);

        return new DataResponse($this->config->wireValue($key));
    }

    public function removeFileName($file, $zone): DataResponse
    {
        if (!$this->config->isKnownZone((string) $zone)) {
            return new DataResponse(null, Http::STATUS_NOT_FOUND);
        }
        $this->config->removeZoneBaseName((string) $zone, (string) $file);

        return new DataResponse(null);
    }

    public function addFileName($file, $zone): DataResponse
    {
        if (!$this->config->isKnownZone((string) $zone)) {
            return new DataResponse(null, Http::STATUS_NOT_FOUND);
        }
        $this->config->addZoneBaseName((string) $zone, (string) $file);

        return new DataResponse($this->adminView->baseNameResponse((string) $zone));
    }
}
