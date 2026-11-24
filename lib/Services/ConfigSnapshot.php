<?php
declare(strict_types=1);

namespace OCA\ReadmeMD\Services;

use InvalidArgumentException;

/**
 * Typed, immutable view of the app configuration.
 *
 * Defaults, wire encoding and decoding live here so every consumer reads the
 * same normalized values. The wire map remains string-valued as required by
 * ADR-0002.
 */
final class ConfigSnapshot
{
    /** @var array<string, bool> */
    private const BOOLEAN_DEFAULTS = [
        'show_asciidoc' => false,
        'show_html' => false,
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

    /** @var array<string, string> */
    private const ENGINE_KEYS = [
        'asciidoc' => 'show_asciidoc',
        'html' => 'show_html',
    ];

    /** @var array<string, string> */
    private const ZONE_KEYS = [
        'header' => 'fileslist_header',
        'footer' => 'fileslist_footer',
    ];

    /** @var array<string, bool> */
    private array $booleans = [];

    /** @var array<string, list<string>> */
    private array $lists = [];

    /** @param array<string, mixed> $rawValues */
    public function __construct(array $rawValues)
    {
        foreach (self::BOOLEAN_DEFAULTS as $key => $default) {
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

    public static function isBooleanKey(string $key): bool
    {
        return array_key_exists($key, self::BOOLEAN_DEFAULTS);
    }

    public static function defaultBoolean(string $key): bool
    {
        self::assertBooleanKey($key);

        return self::BOOLEAN_DEFAULTS[$key];
    }

    public static function engineKey(string $engine): string
    {
        if (!array_key_exists($engine, self::ENGINE_KEYS)) {
            throw new InvalidArgumentException("unknown engine '$engine'");
        }

        return self::ENGINE_KEYS[$engine];
    }

    public static function zoneKey(string $zone): string
    {
        if (!array_key_exists($zone, self::ZONE_KEYS)) {
            throw new InvalidArgumentException("unknown zone '$zone'");
        }

        return self::ZONE_KEYS[$zone];
    }

    public static function isKnownZone(string $zone): bool
    {
        return array_key_exists($zone, self::ZONE_KEYS);
    }

    public static function isZoneKey(string $key): bool
    {
        return in_array($key, self::ZONE_KEYS, true);
    }

    public static function zoneForKey(string $key): string
    {
        $zone = array_search($key, self::ZONE_KEYS, true);
        if ($zone === false) {
            throw new InvalidArgumentException("unknown zone config key '$key'");
        }

        return $zone;
    }

    public function booleanValue(string $key): bool
    {
        self::assertBooleanKey($key);

        return $this->booleans[$key];
    }

    public function isEngineEnabled(string $engine): bool
    {
        return $this->booleanValue(self::engineKey($engine));
    }

    /** @return list<string> */
    public function baseNamesForZone(string $zone): array
    {
        return $this->lists[self::zoneKey($zone)];
    }

    /** @return array<string, string|list<string>> */
    public function toWireArray(): array
    {
        return [
            'show_asciidoc' => self::toWireBoolean($this->booleans['show_asciidoc']),
            'show_html' => self::toWireBoolean($this->booleans['show_html']),
            'yellow_back' => self::toWireBoolean($this->booleans['yellow_back']),
            'show_title' => self::toWireBoolean($this->booleans['show_title']),
            'auto_refresh' => self::toWireBoolean($this->booleans['auto_refresh']),
            'disable_workspace' => self::toWireBoolean($this->booleans['disable_workspace']),
            'fileslist_header' => $this->lists['fileslist_header'],
            'fileslist_footer' => $this->lists['fileslist_footer'],
        ];
    }

    private static function assertBooleanKey(string $key): void
    {
        if (!self::isBooleanKey($key)) {
            throw new InvalidArgumentException("unknown boolean config key '$key'");
        }
    }
}
