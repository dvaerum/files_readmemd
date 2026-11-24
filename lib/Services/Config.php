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
use OCP\IConfig;

class Config {

    private const MISSING = '__files_readmemd_missing__';

    private IConfig $config;
    private string $appName;

    public function __construct(IConfig $config, string $appName){
        $this->config = $config;
        $this->appName = $appName;
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
        $raw = [];
        foreach (array_merge(
            ['show_asciidoc', 'show_html', 'yellow_back', 'show_title', 'auto_refresh', 'disable_workspace'],
            ['fileslist_header', 'fileslist_footer']
        ) as $key) {
            $raw[$key] = $this->rawValue($key);
        }

        return new ConfigSnapshot($raw);
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
        $this->store(ConfigSnapshot::engineKey($engine), ConfigSnapshot::toWireBoolean($enabled));
    }

    public function setFlag(string $key, bool $enabled): void
    {
        if (!ConfigSnapshot::isBooleanKey($key)) {
            throw new InvalidArgumentException("unknown boolean config key '$key'");
        }
        $this->store($key, ConfigSnapshot::toWireBoolean($enabled));
    }

    /** @param list<string> $names */
    public function setZoneBaseNames(string $zone, array $names): void
    {
        $this->store(ConfigSnapshot::zoneKey($zone), ConfigSnapshot::encodeBaseNames($names));
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
        if (ConfigSnapshot::isBooleanKey($key)) {
            $this->setFlag($key, ConfigSnapshot::parseBoolean($value, ConfigSnapshot::defaultBoolean($key)));
            return;
        }

        if (ConfigSnapshot::isZoneKey($key)) {
            $zone = ConfigSnapshot::zoneForKey($key);
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
