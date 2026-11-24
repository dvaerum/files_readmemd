<?php
declare(strict_types=1);

namespace OCA\ReadmeMD\Tests;

use OCA\ReadmeMD\Controller\ConfigController;
use OCA\ReadmeMD\Services\Config;
use OCP\AppFramework\Controller;
use OCP\IConfig;
use OCP\IRequest;
use PHPUnit\Framework\TestCase;

/**
 * @covers \OCA\ReadmeMD\Controller\ConfigController
 */
class ConfigControllerTest extends TestCase
{
    private ConfigController $controller;

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
        $this->controller = new ConfigController(
            'files_readmemd',
            $this->createMock(IRequest::class),
            new Config($configMock, 'files_readmemd')
        );
    }

    public function testGetConfig(): void
    {
        self::assertSame([
            'show_asciidoc' => 'false',
            'show_html' => 'false',
            'yellow_back' => 'true',
            'show_title' => 'true',
            'auto_refresh' => 'false',
            'disable_workspace' => 'true',
            'fileslist_header' => ['HEADER'],
            'fileslist_footer' => ['README'],
        ], $this->controller->getConfig());
    }

    public function testSetConfig(): void
    {
        self::assertSame('true', $this->controller->setConfig('show_html', 'true'));
        self::assertSame('true', $this->controller->getConfig()['show_html']);
    }

    public function testAddAndRemoveFileName(): void
    {
        $this->controller->addFileName('README.md', 'header');
        self::assertSame(['HEADER', 'README.md'], $this->controller->getConfig()['fileslist_header']);

        $this->controller->removeFileName('HEADER', 'header');
        self::assertSame(['README.md'], $this->controller->getConfig()['fileslist_header']);
    }

    public function testAddAndRemoveFooterFileName(): void
    {
        $this->controller->addFileName('FOOTER', 'footer');
        self::assertSame(['README', 'FOOTER'], $this->controller->getConfig()['fileslist_footer']);

        $this->controller->removeFileName('FOOTER', 'footer');
        self::assertSame(['README'], $this->controller->getConfig()['fileslist_footer']);
    }
}
