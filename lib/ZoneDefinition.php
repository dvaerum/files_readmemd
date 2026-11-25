<?php
declare(strict_types=1);

namespace OCA\ReadmeMD;

use InvalidArgumentException;
use JsonException;
use RuntimeException;
use stdClass;

/**
 * The single declaration of the app's zones.
 *
 * One JSON object maps a canonical zone id to the four spellings used at the
 * other seams. Both the PHP and JS loaders validate the same shape and fail
 * loudly instead of guessing which zone a value refers to.
 */
final class ZoneDefinition
{
    private const FIELDS = ['adminToken', 'configKey', 'domClass', 'endpointSegment', 'responseSemantics'];

    /** @var array<string, array<string, string>> */
    private array $zones = [];

    /** @var array<string, array<string, string>> */
    private array $byValue = [];

    public function __construct(?string $path = null)
    {
        $path = $path ?? dirname(__DIR__) . '/zones.json';
        if (!is_file($path) || !is_readable($path)) {
            throw new RuntimeException("cannot read zone declaration '$path'");
        }

        $contents = file_get_contents($path);
        if ($contents === false) {
            throw new RuntimeException("cannot read zone declaration '$path'");
        }

        try {
            $decoded = json_decode($contents, false, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException $e) {
            throw new InvalidArgumentException(
                "invalid zone declaration '$path': " . $e->getMessage(),
                0,
                $e
            );
        }

        if (!$decoded instanceof stdClass) {
            throw new InvalidArgumentException("zone declaration '$path' must be a JSON object");
        }

        foreach (get_object_vars($decoded) as $id => $rawZone) {
            if ($id === '') {
                throw new InvalidArgumentException("zone declaration '$path' has an empty zone id");
            }
            if (!$rawZone instanceof stdClass) {
                throw new InvalidArgumentException("zone '$id' must be an object");
            }

            $zone = [];
            foreach (self::FIELDS as $field) {
                $value = $rawZone->$field ?? null;
                if (!is_string($value) || trim($value) === '') {
                    throw new InvalidArgumentException(
                        "zone '$id' must define a non-empty string '$field'"
                    );
                }
                if (isset($this->byValue[$field][$value])) {
                    throw new InvalidArgumentException(
                        "duplicate '$field' value '$value' in zone declaration '$path'"
                    );
                }
                $zone[$field] = $value;
            }

            foreach (self::FIELDS as $field) {
                $this->byValue[$field][$zone[$field]] = $id;
            }
            $this->zones[$id] = $zone;
        }

        if ($this->zones === []) {
            throw new InvalidArgumentException("zone declaration '$path' has no zones");
        }
    }

    /** @return list<string> */
    public function ids(): array
    {
        return array_keys($this->zones);
    }

    public function has(string $id): bool
    {
        return array_key_exists($id, $this->zones);
    }

    /** @return array<string, string> */
    public function get(string $id): array
    {
        if (!$this->has($id)) {
            throw new InvalidArgumentException("unknown zone '$id'");
        }

        return $this->zones[$id];
    }

    public function field(string $id, string $field): string
    {
        if (!in_array($field, self::FIELDS, true)) {
            throw new InvalidArgumentException("unknown zone field '$field'");
        }

        return $this->get($id)[$field];
    }

    public function hasValue(string $field, string $value): bool
    {
        return isset($this->byValue[$field][$value]);
    }

    public function idFor(string $field, string $value): string
    {
        if (!in_array($field, self::FIELDS, true)) {
            throw new InvalidArgumentException("unknown zone field '$field'");
        }
        if (!$this->hasValue($field, $value)) {
            throw new InvalidArgumentException("unknown zone '$field' value '$value'");
        }

        return $this->byValue[$field][$value];
    }

    public function hasAdminToken(string $token): bool
    {
        return $this->hasValue('adminToken', $token);
    }

    public function idForAdminToken(string $token): string
    {
        return $this->idFor('adminToken', $token);
    }

    public function idForConfigKey(string $key): string
    {
        return $this->idFor('configKey', $key);
    }

    public function idForDomClass(string $domClass): string
    {
        return $this->idFor('domClass', $domClass);
    }

    public function idForEndpointSegment(string $segment): string
    {
        return $this->idFor('endpointSegment', $segment);
    }
}
