<?php
declare(strict_types=1);

namespace OCA\ReadmeMD\Tests;

use OCA\ReadmeMD\EngineDefinition;
use OCA\ReadmeMD\Services\Config;
use OCA\ReadmeMD\Settings\Admin\Engine;
use OCP\IConfig;
use OCP\IL10N;
use PHPUnit\Framework\TestCase;

/**
 * @covers \OCA\ReadmeMD\Settings\Admin\Engine
 */
class EngineTest extends TestCase
{
    /** @param array<string, string> $values */
    private function newEngine(array $values = []): Engine
    {
        $configMock = $this->createMock(IConfig::class);
        $configMock->method('getAppValue')->willReturnCallback(
            function (string $appName, string $key, ?string $default = null) use ($values): ?string {
                return $values[$key] ?? $default;
            }
        );

        return new Engine(new Config($configMock, 'files_readmemd'), $this->createMock(IL10N::class));
    }

    public function testEngine(): void
    {
        $engine = $this->newEngine();
        self::assertSame('files_readmemd', $engine->getSection());
        self::assertSame(50, $engine->getPriority());
    }

    public function testGetFormExposesTypedEngineState(): void
    {
        $params = $this->newEngine([
            'show_asciidoc' => '1',
            'show_html' => 'false',
        ])->getForm()->getParams();

        self::assertInstanceOf(EngineDefinition::class, $params['engines']);
        self::assertSame([
            'show_asciidoc' => true,
            'show_html' => false,
        ], array_intersect_key($params, array_flip(['show_asciidoc', 'show_html'])));
    }
}
