<?php
declare(strict_types=1);

namespace OCA\ReadmeMD\Tests;

use OCA\ReadmeMD\Listeners\LoadAdditionalPublicScriptsListener;
use OCA\ReadmeMD\Listeners\LoadAdditionalScriptsListener;
use OCA\ReadmeMD\Services\Config;
use OCP\AppFramework\Services\IInitialState;
use OCP\EventDispatcher\Event;
use OCP\IConfig;
use PHPUnit\Framework\TestCase;

/**
 * @covers \OCA\ReadmeMD\Listeners\LoadAdditionalScriptsListener
 * @covers \OCA\ReadmeMD\Listeners\LoadAdditionalPublicScriptsListener
 */
class ListenerTest extends TestCase
{
    private function newConfig(): Config
    {
        $configMock = $this->createMock(IConfig::class);
        $configMock->method('getAppValue')->willReturnCallback(
            function (string $appName, string $key, ?string $default = null): ?string {
                $values = ['show_asciidoc' => '1', 'fileslist_footer' => '["README","FEATURES"]'];
                return $values[$key] ?? $default;
            }
        );

        return new Config($configMock, 'files_readmemd');
    }

    /** @return array{0: object, 1: IInitialState} */
    private function expectInitialState(): array
    {
        $initialState = $this->createMock(IInitialState::class);
        $initialState->expects(self::once())
            ->method('provideInitialState')
            ->with('config', self::callback(function ($wire): bool {
                return is_array($wire)
                    && $wire['show_asciidoc'] === 'true'
                    && $wire['fileslist_footer'] === ['README', 'FEATURES'];
            }));

        return [$this->newConfig(), $initialState];
    }

    public function testPrivateListenerRegistersItsOwnScriptAsset(): void
    {
        [$config, $initialState] = $this->expectInitialState();
        $listener = new class($config, $initialState) extends LoadAdditionalScriptsListener {
            /** @var list<array{0: string, 1: string}> */
            public array $scriptCalls = [];

            protected function addScript(string $app, string $script): void
            {
                $this->scriptCalls[] = [$app, $script];
            }
        };

        $listener->handle(new Event());

        self::assertSame([['files_readmemd', 'files_readmemd-main']], $listener->scriptCalls);
    }

    public function testPublicListenerRegistersItsOwnScriptAsset(): void
    {
        [$config, $initialState] = $this->expectInitialState();
        $listener = new class($config, $initialState) extends LoadAdditionalPublicScriptsListener {
            /** @var list<array{0: string, 1: string}> */
            public array $scriptCalls = [];

            protected function addScript(string $app, string $script): void
            {
                $this->scriptCalls[] = [$app, $script];
            }
        };

        $listener->handle(new Event());

        self::assertSame([['files_readmemd', 'files_readmemd-public']], $listener->scriptCalls);
    }
}
