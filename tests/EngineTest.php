<?php
declare(strict_types=1);

namespace OCA\ReadmeMD\Tests;

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
    public function testEngine(): void
    {
        $configMock = $this->createMock(IConfig::class);
        $configMock->method('getAppValue')->willReturn(null);
        $configMock->method('setAppValue')->willReturn(null);
        $engine = new Engine(new Config($configMock, 'files_readmemd'), $this->createMock(IL10N::class));
        self::assertSame('files_readmemd', $engine->getSection());
        self::assertSame(50, $engine->getPriority());
    }
}
