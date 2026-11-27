<?php
declare(strict_types=1);

namespace OCA\ReadmeMD\Services;

use InvalidArgumentException;
use OCA\ReadmeMD\EngineDefinition;
use OCA\ReadmeMD\ZoneDefinition;

/**
 * Typed, immutable view of the app configuration.
 *
 * Defaults, wire encoding and decoding live here so every consumer reads the
 * same normalized values. The wire map remains string-valued as required by
 * ADR-0002, and its zone entries come from the single zone declaration.
 */
final class ConfigSnapshot
{
    /** @var array<string, bool> */
    private const FLAG_DEFAULTS = [
        'yellow_back' => true,
        'show_title' => true,
        'auto_refresh' => false,
        'disable_workspace' => true,
    ];

    /** @var array<string, list<string>> */
    private const LIST_DEFAULTS = [
        'fileslist_header' => ['HEADER'],
        'fileslist_footer' => ['README'],
    ];

    private ZoneDefinition $zones;
    private EngineDefinition $engines;

    /** @var array<string, bool> */
    private array $booleans = [];

    /** @var array<string, list<string>> */
    private array $lists = [];

    /**
     * @param array<string, mixed> $rawValues
     */
    public function __construct(
        array $rawValues,
        ?ZoneDefinition $zones = null,
        ?EngineDefinition $engines = null
    ) {
        $this->zones = $zones ?? new ZoneDefinition();
        $this->engines = $engines ?? new EngineDefinition();

        foreach ($this->zones->ids() as $id) {
            $key = $this->zones->field($id, 'configKey');
            if (!array_key_exists($key, self::LIST_DEFAULTS)) {
                throw new InvalidArgumentException(
                    "no default base names for zone '$id' (config key '$key')"
                );
            }
        }

        $defaults = [];
        foreach ($this->engines->wireKeys() as $key) {
            $defaults[$key] = $this->engines->wireDefault($this->engines->idForWireKey($key));
        }
        foreach (self::FLAG_DEFAULTS as $key => $default) {
            $defaults[$key] = $default;
        }

        foreach ($defaults as $key => $default) {
            $raw = $rawValues[$key] ?? null;
            $this->booleans[$key] = $raw === null
                ? $default
                : self::parseBoolean((string) $raw, $default);
        }

        foreach (self::LIST_DEFAULTS as $key => $default) {
            $this->lists[$key] = self::parseBaseNames($rawValues[$key] ?? null, $default);
        }
    }

    public static function parseBoolean(string $value, bool $default): bool
    {
        switch (strtolower(trim($value))) {
            case 'true':
            case '1':
            case 'on':
            case 'yes':
                return true;
            case 'false':
            case '0':
            case 'off':
            case 'no':
            case '':
                return false;
            default:
                return $default;
        }
    }

    public static function toWireBoolean(bool $value): string
    {
        return $value ? 'true' : 'false';
    }

    /** @param mixed $raw */
    public static function parseBaseNames($raw, array $default): array
    {
        if (!is_string($raw)) {
            return $default;
        }

        $decoded = json_decode($raw, true);
        if (!is_array($decoded) || array_values($decoded) !== $decoded) {
            return $default;
        }

        foreach ($decoded as $name) {
            if (!is_string($name)) {
                return $default;
            }
        }

        return $decoded;
    }

    /** @param list<string> $names */
    public static function encodeBaseNames(array $names): string
    {
        if (array_values($names) !== $names) {
            throw new InvalidArgumentException('base names must be a list');
        }
        foreach ($names as $name) {
            if (!is_string($name)) {
                throw new InvalidArgumentException('base names must be strings');
            }
        }

        return json_encode($names, JSON_THROW_ON_ERROR);
    }

    public function isBooleanKey(string $key): bool
    {
        return array_key_exists($key, self::FLAG_DEFAULTS) || $this->engines->hasWireKey($key);
    }

    public function defaultBoolean(string $key): bool
    {
        $this->assertBooleanKey($key);

        if ($this->engines->hasWireKey($key)) {
            return $this->engines->wireDefault($this->engines->idForWireKey($key));
        }

        return self::FLAG_DEFAULTS[$key];
    }

    /** @return list<string> */
    public static function booleanKeys(?EngineDefinition $engines = null): array
    {
        $engines = $engines ?? new EngineDefinition();

        return array_merge($engines->wireKeys(), array_keys(self::FLAG_DEFAULTS));
    }

    public function engineKey(string $engine): string
    {
        $key = $this->engines->wireKey($engine);
        if ($key === null) {
            throw new InvalidArgumentException("engine '$engine' has no wire key");
        }

        return $key;
    }

    public function zoneKey(string $adminToken): string
    {
        return $this->zones->field($this->zones->idForAdminToken($adminToken), 'configKey');
    }

    public function isKnownZone(string $adminToken): bool
    {
        return $this->zones->hasAdminToken($adminToken);
    }

    public function isZoneKey(string $key): bool
    {
        return $this->zones->hasValue('configKey', $key);
    }

    public function zoneForKey(string $key): string
    {
        return $this->zones->field($this->zones->idForConfigKey($key), 'adminToken');
    }

    public function booleanValue(string $key): bool
    {
        $this->assertBooleanKey($key);

        return $this->booleans[$key];
    }

    public function isEngineEnabled(string $engine): bool
    {
        return $this->booleanValue($this->engineKey($engine));
    }

    public function zones(): ZoneDefinition
    {
        return $this->zones;
    }

    public function engines(): EngineDefinition
    {
        return $this->engines;
    }

    /** @return list<string> */
    public function baseNamesForZone(string $adminToken): array
    {
        return $this->lists[$this->zoneKey($adminToken)];
    }

    /** @return array<string, string|list<string>> */
    public function toWireArray(): array
    {
        $wire = [];
        foreach ($this->booleans as $key => $value) {
            $wire[$key] = self::toWireBoolean($value);
        }

        foreach ($this->zones->ids() as $id) {
            $key = $this->zones->field($id, 'configKey');
            $wire[$key] = $this->lists[$key];
        }

        return $wire;
    }

    private function assertBooleanKey(string $key): void
    {
        if (!$this->isBooleanKey($key)) {
            throw new InvalidArgumentException("unknown boolean config key '$key'");
        }
    }
}
