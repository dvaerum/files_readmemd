<?php
declare(strict_types=1);

namespace OCA\ReadmeMD\Tests;

use OCA\ReadmeMD\Services\Config;
use OCP\IConfig;
use PHPUnit\Framework\TestCase;

/**
 * @covers \OCA\ReadmeMD\Services\Config
 * @covers \OCA\ReadmeMD\Services\ConfigSnapshot
 */
class ConfigTest extends TestCase
{
    /** @var array<string, string> */
    private array $values = [];

    /** @param array<string, string> $values */
    private function newConfig(array $values = []): Config
    {
        $this->values = $values;
        $configMock = $this->createMock(IConfig::class);
        $configMock->method('getAppValue')->willReturnCallback(
            function (string $appName, string $key, ?string $default = null): ?string {
                return $this->values[$key] ?? $default;
            }
        );
        $configMock->method('setAppValue')->willReturnCallback(
            function (string $appName, string $key, string $value): void {
                $this->values[$key] = $value;
            }
        );

        return new Config($configMock, 'files_readmemd');
    }

    public function testSnapshotDefaults(): void
    {
        $config = $this->newConfig();
        $snapshot = $config->snapshot();

        self::assertFalse($snapshot->isEngineEnabled('asciidoc'));
        self::assertFalse($snapshot->isEngineEnabled('html'));
        self::assertSame(['HEADER'], $snapshot->baseNamesForZone('header'));
        self::assertSame(['README'], $snapshot->baseNamesForZone('footer'));
        self::assertSame([
            'show_asciidoc' => 'false',
            'show_html' => 'false',
            'fileslist_header' => ['HEADER'],
            'fileslist_footer' => ['README'],
        ], $snapshot->toWireArray());
        // Defaults are derived on read; constructing config has no write side effect.
        self::assertSame([], $this->values);
    }

    public function testMalformedZoneListsFallBackToDefaults(): void
    {
        $config = $this->newConfig([
            'fileslist_header' => '{"not":"a list"}',
            'fileslist_footer' => '"README"',
        ]);

        self::assertSame(['HEADER'], $config->zoneBaseNames('header'));
        self::assertSame(['README'], $config->zoneBaseNames('footer'));
    }

    public function testBooleanParsing(): void
    {
        $snapshot = $this->newConfig([
            'show_asciidoc' => '1',
            'show_html' => 'ON',
            'show_title' => 'no',
            'yellow_back' => 'garbage',
            'fileslist_header' => '["HEADER"]',
        ])->snapshot();

        self::assertSame([
            'show_asciidoc' => 'true',
            'show_html' => 'true',
            'fileslist_header' => ['HEADER'],
            'fileslist_footer' => ['README'],
        ], $snapshot->toWireArray());
    }

    public function testOrderedAddAndRemoveZoneBaseNames(): void
    {
        $config = $this->newConfig(['fileslist_header' => '["HEADER","EXTRA"]']);

        $config->addZoneBaseName('header', 'FOO');
        $config->addZoneBaseName('header', 'BAR');
        $config->removeZoneBaseName('header', 'HEADER');
        $config->removeZoneBaseName('header', 'MISSING');

        self::assertSame(['EXTRA', 'FOO', 'BAR'], $config->zoneBaseNames('header'));
        self::assertSame(['README'], $config->zoneBaseNames('footer'));
    }

    public function testTypedSettersNormalizeWireValues(): void
    {
        $config = $this->newConfig();
        $config->setEngineEnabled('html', true);
        $config->setWireValue('show_html', 'false');
        $config->setZoneBaseNames('footer', ['README', 'FEATURES']);

        self::assertSame('false', $this->values['show_html']);
        self::assertSame('["README","FEATURES"]', $this->values['fileslist_footer']);
        self::assertFalse($config->isEngineEnabled('html'));
        self::assertSame(['README', 'FEATURES'], $config->zoneBaseNames('footer'));
    }

    public function testUnknownZoneAndEngineAreRejected(): void
    {
        $config = $this->newConfig();

        try {
            $config->zoneBaseNames('sidebar');
            self::fail('unknown zone was accepted');
        } catch (\InvalidArgumentException $e) {
            self::assertStringContainsString('sidebar', $e->getMessage());
        }

        try {
            $config->isEngineEnabled('markdown-plus');
            self::fail('unknown engine was accepted');
        } catch (\InvalidArgumentException $e) {
            self::assertStringContainsString('markdown-plus', $e->getMessage());
        }
    }
}
