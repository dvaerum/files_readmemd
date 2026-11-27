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

namespace OCA\ReadmeMD\Services ;

use InvalidArgumentException;
use OCA\ReadmeMD\EngineDefinition;
use OCA\ReadmeMD\ZoneDefinition;
use OCP\IConfig;

class Config {

    private const MISSING = '__files_readmemd_missing__';

    private IConfig $config;
    private string $appName;
    private ZoneDefinition $zones;
    private EngineDefinition $engines;

    public function __construct(IConfig $config, string $appName, ?EngineDefinition $engines = null)
    {
        $this->config = $config;
        $this->appName = $appName;
        $this->zones = new ZoneDefinition();
        $this->engines = $engines ?? new EngineDefinition();
    }

    public function engines(): EngineDefinition
    {
        return $this->engines;
    }

    public function isKnownZone(string $adminToken): bool
    {
        return $this->zones->hasAdminToken($adminToken);
    }

    public function zones(): ZoneDefinition
    {
        return $this->zones;
    }

    private function rawValue(string $key): ?string
    {
        // A sentinel distinguishes an unset key from a stored empty string,
        // without passing null to IConfig's string default parameter.
        $value = $this->config->getAppValue($this->appName, $key, self::MISSING);

        return $value === self::MISSING ? null : (string) $value;
    }

    private function store(string $key, string $value): void
    {
        $this->config->setAppValue($this->appName, $key, $value);
    }

    public function snapshot(): ConfigSnapshot
    {
        $keys = ConfigSnapshot::booleanKeys($this->engines);
        foreach ($this->zones->ids() as $id) {
            $keys[] = $this->zones->field($id, 'configKey');
        }

        $raw = [];
        foreach ($keys as $key) {
            $raw[$key] = $this->rawValue($key);
        }

        return new ConfigSnapshot($raw, $this->zones, $this->engines);
    }

    public function isEngineEnabled(string $engine): bool
    {
        return $this->snapshot()->isEngineEnabled($engine);
    }

    /** @return list<string> */
    public function zoneBaseNames(string $zone): array
    {
        return $this->snapshot()->baseNamesForZone($zone);
    }

    public function setEngineEnabled(string $engine, bool $enabled): void
    {
        $this->store($this->snapshot()->engineKey($engine), ConfigSnapshot::toWireBoolean($enabled));
    }

    public function setFlag(string $key, bool $enabled): void
    {
        if (!$this->snapshot()->isBooleanKey($key)) {
            throw new InvalidArgumentException("unknown boolean config key '$key'");
        }
        $this->store($key, ConfigSnapshot::toWireBoolean($enabled));
    }

    /** @param list<string> $names */
    public function setZoneBaseNames(string $zone, array $names): void
    {
        $key = $this->zones->field($this->zones->idForAdminToken($zone), 'configKey');
        $this->store($key, ConfigSnapshot::encodeBaseNames($names));
    }

    public function addZoneBaseName(string $zone, string $name): void
    {
        $names = $this->zoneBaseNames($zone);
        $names[] = $name;
        $this->setZoneBaseNames($zone, $names);
    }

    public function removeZoneBaseName(string $zone, string $name): void
    {
        $names = $this->zoneBaseNames($zone);
        $index = array_search($name, $names, true);
        if ($index !== false) {
            array_splice($names, $index, 1);
            $this->setZoneBaseNames($zone, $names);
        }
    }

    /**
     * Typed implementation of the legacy wire setter. Unknown keys are rejected
     * instead of writing arbitrary app config.
     */
    public function setWireValue(string $key, string $value): void
    {
        $snapshot = $this->snapshot();
        if ($snapshot->isBooleanKey($key)) {
            $this->setFlag($key, ConfigSnapshot::parseBoolean($value, $snapshot->defaultBoolean($key)));
            return;
        }

        if ($this->zones->hasValue('configKey', $key)) {
            $zone = $this->zones->field($this->zones->idForConfigKey($key), 'adminToken');
            $this->setZoneBaseNames($zone, ConfigSnapshot::parseBaseNames($value, $this->zoneBaseNames($zone)));
            return;
        }

        throw new InvalidArgumentException("unknown config key '$key'");
    }

    /** Wire representation kept for the legacy setConfig route response. */
    public function wireValue(string $key): string
    {
        $wire = $this->snapshot()->toWireArray();
        if (!array_key_exists($key, $wire)) {
            throw new InvalidArgumentException("unknown config key '$key'");
        }

        return is_array($wire[$key]) ? ConfigSnapshot::encodeBaseNames($wire[$key]) : $wire[$key];
    }
}
