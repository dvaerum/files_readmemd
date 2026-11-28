<?php
declare(strict_types=1);

namespace OCA\ReadmeMD\Tests;

use OCA\ReadmeMD\Controller\ConfigController;
use OCA\ReadmeMD\Services\Config;
use OCP\IConfig;
use OCP\IL10N;
use OCP\IRequest;
use PHPUnit\Framework\TestCase;

/**
 * @covers \OCA\ReadmeMD\Controller\ConfigController
 */
class ConfigControllerTest extends TestCase
{
    private ConfigController $controller;
    private Config $config;

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
        $this->config = new Config($configMock, 'files_readmemd');
        $this->controller = new ConfigController(
            'files_readmemd',
            $this->createMock(IRequest::class),
            $this->config,
            $this->createMock(IL10N::class)
        );

        return $this->controller;
    }

    public function testSetConfigReturnsTheWrittenWireValue(): void
    {
        $response = $this->newController()->setConfig('show_html', 'true');

        self::assertSame('true', $response->getData());
        self::assertSame('true', $this->config->snapshot()->toWireArray()['show_html']);
    }

    public function testSetConfigNormalizesLegacyBoolean(): void
    {
        $response = $this->newController()->setConfig('show_html', '1');

        self::assertSame('true', $response->getData());
        self::assertSame('true', $this->values['show_html']);
    }

    public function testSetConfigRejectsUnknownKey(): void
    {
        $controller = $this->newController();
        $this->expectException(\InvalidArgumentException::class);
        $controller->setConfig('not_a_setting', 'true');
    }

    public function testRemovedFlagsAreRejectedAsConfigKeys(): void
    {
        $controller = $this->newController();
        $this->expectException(\InvalidArgumentException::class);
        $controller->setConfig('show_title', 'true');
    }

    public function testAddAndRemoveFileName(): void
    {
        $controller = $this->newController();
        self::assertNull($controller->addFileName('README.md', 'nonexistent')->getData());
        self::assertSame(404, $controller->addFileName('README.md', 'nonexistent')->getStatus());
        self::assertNull($controller->addFileName('README.md', 'header')->getData());
        self::assertSame(['HEADER', 'README.md'], $this->config->zoneBaseNames('header'));

        $controller->removeFileName('HEADER', 'header');
        self::assertSame(['README.md'], $this->config->zoneBaseNames('header'));
    }

    public function testAddAndRemoveFooterFileName(): void
    {
        $controller = $this->newController();
        self::assertSame('success', $controller->addFileName('FOOTER', 'footer')->getData());
        self::assertSame(['README', 'FOOTER'], $this->config->zoneBaseNames('footer'));

        $controller->removeFileName('FOOTER', 'footer');
        self::assertSame(['README'], $this->config->zoneBaseNames('footer'));
    }

    public function testReservedCharactersRoundTripThroughAnEncodedUrlSegment(): void
    {
        // The router decodes the single URL segment before calling the
        // controller; the stored Base name must be byte-identical afterwards.
        $encodedSegment = 'README%3F%26%2F%23%2B%3D%20%25';
        $baseName = rawurldecode($encodedSegment);
        self::assertSame('README?&/#+= %', $baseName);

        $controller = $this->newController();
        self::assertSame('success', $controller->addFileName($baseName, 'footer')->getData());
        self::assertSame(['README', $baseName], $this->config->zoneBaseNames('footer'));

        $controller->removeFileName($baseName, 'footer');
        self::assertSame(['README'], $this->config->zoneBaseNames('footer'));
    }
}
