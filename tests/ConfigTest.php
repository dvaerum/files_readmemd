<?php
declare(strict_types=1);

namespace OCA\ReadmeMD\Tests;

use OCA\ReadmeMD\Services\Config;
use OCP\IConfig;
use PHPUnit\Framework\TestCase;

/**
 * @covers \OCA\ReadmeMD\Services\Config
 */
class ConfigTest extends TestCase
{
    private Config $config;

    /** @var array<string, string> */
    private array $values = [];

    public function setUp(): void
    {
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
        $this->config = new Config($configMock, 'files_readmemd');
    }

    public function testSetDefaults(): void
    {
        self::assertSame('false', $this->config->getAppValue('show_asciidoc'));
        self::assertSame('false', $this->config->getAppValue('show_html'));
        self::assertSame('true', $this->config->getAppValue('show_title'));
        self::assertSame('true', $this->config->getAppValue('yellow_back'));
        self::assertSame('false', $this->config->getAppValue('auto_refresh'));
        self::assertSame('true', $this->config->getAppValue('disable_workspace'));
        self::assertSame('["HEADER"]', $this->config->getAppValue('fileslist_header'));
        self::assertSame('["README"]', $this->config->getAppValue('fileslist_footer'));
    }

    public function testGetAllAppValue(): void
    {
        self::assertSame([
            'show_asciidoc' => 'false',
            'show_html' => 'false',
            'fileslist_header' => ['HEADER'],
            'fileslist_footer' => ['README'],
        ], $this->config->getAllAppValue());
    }

    public function testGetSetAppValue(): void
    {
        self::assertSame('false', $this->config->getAppValue('show_asciidoc'));
        $this->config->setAppValue('show_asciidoc', 'true');
        self::assertSame('true', $this->config->getAppValue('show_asciidoc'));
    }
}
