<?php
declare(strict_types=1);

namespace OCA\ReadmeMD\Tests;

use OCA\ReadmeMD\Controller\ConfigController;
use OCA\ReadmeMD\Services\Config;
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

    /** @param array<string, string> $values */
    private function newController(array $values = []): ConfigController
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
        $this->controller = new ConfigController(
            'files_readmemd',
            $this->createMock(IRequest::class),
            new Config($configMock, 'files_readmemd')
        );

        return $this->controller;
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
        ], $this->newController()->getConfig());
    }

    public function testSetConfig(): void
    {
        $controller = $this->newController();
        self::assertSame('true', $controller->setConfig('show_html', 'true'));
        self::assertSame('true', $controller->getConfig()['show_html']);
    }

    public function testSetConfigNormalizesLegacyBoolean(): void
    {
        $controller = $this->newController();
        self::assertSame('true', $controller->setConfig('show_html', '1'));
        self::assertSame('true', $this->values['show_html']);
        self::assertSame('true', $controller->getConfig()['show_html']);
    }

    public function testSetConfigRejectsUnknownKey(): void
    {
        $controller = $this->newController();
        $this->expectException(\InvalidArgumentException::class);
        $controller->setConfig('not_a_setting', 'true');
    }

    public function testAddAndRemoveFileName(): void
    {
        $controller = $this->newController();
        $controller->addFileName('README.md', 'header');
        self::assertSame(['HEADER', 'README.md'], $controller->getConfig()['fileslist_header']);

        $controller->removeFileName('HEADER', 'header');
        self::assertSame(['README.md'], $controller->getConfig()['fileslist_header']);
    }

    public function testAddAndRemoveFooterFileName(): void
    {
        $controller = $this->newController();
        $controller->addFileName('FOOTER', 'footer');
        self::assertSame(['README', 'FOOTER'], $controller->getConfig()['fileslist_footer']);

        $controller->removeFileName('FOOTER', 'footer');
        self::assertSame(['README'], $controller->getConfig()['fileslist_footer']);
    }
}
