<?php
declare(strict_types=1);

namespace OCA\ReadmeMD;

use InvalidArgumentException;
use JsonException;
use RuntimeException;
use stdClass;

/**
 * The single declaration of the app's Render engines.
 *
 * One JSON object maps a canonical engine id to its ordered extensions, wire
 * setting, default, always-on fact and admin control id. Declaration order is
 * the File election rank. Both the PHP and JS loaders validate the same shape
 * and fail loudly instead of guessing which engine a value refers to.
 */
final class EngineDefinition
{
    private const FIELDS = ['extensions', 'wireKey', 'wireDefault', 'alwaysOn', 'adminControlId'];

    /** @var array<string, array<string, mixed>> */
    private array $engines = [];

    /** @var array<string, string> */
    private array $byExtension = [];

    /** @var array<string, string> */
    private array $byWireKey = [];

    /** @var array<string, string> */
    private array $byAdminControlId = [];

    public function __construct(?string $path = null)
    {
        $path = $path ?? dirname(__DIR__) . '/engines.json';
        if (!is_file($path) || !is_readable($path)) {
            throw new RuntimeException("cannot read engine declaration '$path'");
        }

        $contents = file_get_contents($path);
        if ($contents === false) {
            throw new RuntimeException("cannot read engine declaration '$path'");
        }

        try {
            $decoded = json_decode($contents, false, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException $e) {
            throw new InvalidArgumentException(
                "invalid engine declaration '$path': " . $e->getMessage(),
                0,
                $e
            );
        }

        if (!$decoded instanceof stdClass) {
            throw new InvalidArgumentException("engine declaration '$path' must be a JSON object");
        }

        foreach (get_object_vars($decoded) as $id => $rawEngine) {
            if ($id === '') {
                throw new InvalidArgumentException("engine declaration '$path' has an empty engine id");
            }
            if (!$rawEngine instanceof stdClass) {
                throw new InvalidArgumentException("engine '$id' must be an object");
            }
            foreach (self::FIELDS as $field) {
                if (!property_exists($rawEngine, $field)) {
                    throw new InvalidArgumentException(
                        "engine '$id' must define a non-empty string '$field'"
                    );
                }
            }

            $extensions = $rawEngine->extensions;
            if (!is_array($extensions) || !array_is_list($extensions) || $extensions === []) {
                throw new InvalidArgumentException("engine '$id' must define a non-empty 'extensions' list");
            }
            foreach ($extensions as $extension) {
                if (!is_string($extension) || trim($extension) === '') {
                    throw new InvalidArgumentException("engine '$id' has an invalid extension");
                }
                if (isset($this->byExtension[$extension])) {
                    throw new InvalidArgumentException(
                        "duplicate '$extension' extension in engine declaration '$path'"
                    );
                }
                $this->byExtension[$extension] = $id;
            }

            $alwaysOn = $rawEngine->alwaysOn;
            $wireDefault = $rawEngine->wireDefault;
            if (!is_bool($alwaysOn)) {
                throw new InvalidArgumentException("engine '$id' must define a boolean 'alwaysOn'");
            }
            if (!is_bool($wireDefault)) {
                throw new InvalidArgumentException("engine '$id' must define a boolean 'wireDefault'");
            }

            $wireKey = $rawEngine->wireKey;
            if ($alwaysOn) {
                if ($wireKey !== null) {
                    throw new InvalidArgumentException(
                        "engine '$id' must not define 'wireKey' when always on"
                    );
                }
            } else {
                if (!is_string($wireKey) || trim($wireKey) === '') {
                    throw new InvalidArgumentException(
                        "engine '$id' must define a non-empty string 'wireKey'"
                    );
                }
                if (isset($this->byWireKey[$wireKey])) {
                    throw new InvalidArgumentException(
                        "duplicate '$wireKey' wire key in engine declaration '$path'"
                    );
                }
                $this->byWireKey[$wireKey] = $id;
            }

            $adminControlId = $rawEngine->adminControlId;
            if (!is_string($adminControlId) || trim($adminControlId) === '') {
                throw new InvalidArgumentException(
                    "engine '$id' must define a non-empty string 'adminControlId'"
                );
            }
            if (isset($this->byAdminControlId[$adminControlId])) {
                throw new InvalidArgumentException(
                    "duplicate '$adminControlId' admin control in engine declaration '$path'"
                );
            }
            $this->byAdminControlId[$adminControlId] = $id;

            $this->engines[$id] = [
                'extensions' => $extensions,
                'wireKey' => $wireKey,
                'wireDefault' => $wireDefault,
                'alwaysOn' => $alwaysOn,
                'adminControlId' => $adminControlId,
            ];
        }

        if ($this->engines === []) {
            throw new InvalidArgumentException("engine declaration '$path' has no engines");
        }
    }

    /** @return list<string> */
    public function ids(): array
    {
        return array_keys($this->engines);
    }

    /** @return list<string> */
    public function configurableIds(): array
    {
        return array_values(array_filter(
            $this->ids(),
            fn (string $id): bool => !$this->isAlwaysOn($id)
        ));
    }

    public function has(string $id): bool
    {
        return array_key_exists($id, $this->engines);
    }

    /** @return array<string, mixed> */
    public function get(string $id): array
    {
        if (!$this->has($id)) {
            throw new InvalidArgumentException("unknown engine '$id'");
        }

        return $this->engines[$id];
    }

    public function field(string $id, string $field): mixed
    {
        if (!in_array($field, self::FIELDS, true)) {
            throw new InvalidArgumentException("unknown engine field '$field'");
        }

        return $this->get($id)[$field];
    }

    /** @return list<string> */
    public function extensions(string $id): array
    {
        /** @var list<string> $extensions */
        $extensions = $this->field($id, 'extensions');

        return $extensions;
    }

    public function wireKey(string $id): ?string
    {
        /** @var string|null $wireKey */
        $wireKey = $this->field($id, 'wireKey');

        return $wireKey;
    }

    public function wireDefault(string $id): bool
    {
        return (bool) $this->field($id, 'wireDefault');
    }

    public function isAlwaysOn(string $id): bool
    {
        return (bool) $this->field($id, 'alwaysOn');
    }

    public function adminControlId(string $id): string
    {
        return (string) $this->field($id, 'adminControlId');
    }

    /** @return list<string> */
    public function wireKeys(): array
    {
        return array_keys($this->byWireKey);
    }

    public function hasWireKey(string $key): bool
    {
        return isset($this->byWireKey[$key]);
    }

    public function idForWireKey(string $key): string
    {
        if (!$this->hasWireKey($key)) {
            throw new InvalidArgumentException("unknown engine 'wireKey' value '$key'");
        }

        return $this->byWireKey[$key];
    }

    public function hasAdminControlId(string $controlId): bool
    {
        return isset($this->byAdminControlId[$controlId]);
    }

    public function idForAdminControlId(string $controlId): string
    {
        if (!$this->hasAdminControlId($controlId)) {
            throw new InvalidArgumentException("unknown engine 'adminControlId' value '$controlId'");
        }

        return $this->byAdminControlId[$controlId];
    }

    public function hasExtension(string $extension): bool
    {
        return isset($this->byExtension[$extension]);
    }

    public function idForExtension(string $extension): string
    {
        if (!$this->hasExtension($extension)) {
            throw new InvalidArgumentException("unknown engine 'extensions' value '$extension'");
        }

        return $this->byExtension[$extension];
    }

    public function rank(string $id): int
    {
        $index = array_search($id, $this->ids(), true);
        if ($index === false) {
            throw new InvalidArgumentException("unknown engine '$id'");
        }

        return $index + 1;
    }
}
