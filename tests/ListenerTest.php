<?php
declare(strict_types=1);

namespace OCA\ReadmeMD\Tests;

use ArrayObject;
use Closure;
use OCA\ReadmeMD\AppInfo\Application;
use OCA\ReadmeMD\Listeners\AbstractScriptListener;
use OCA\ReadmeMD\Listeners\LoadAdditionalPublicScriptsListener;
use OCA\ReadmeMD\Listeners\LoadAdditionalScriptsListener;
use OCA\ReadmeMD\Services\Config;
use OCP\AppFramework\Bootstrap\IRegistrationContext;
use OCP\AppFramework\Services\IInitialState;
use OCP\EventDispatcher\Event;
use OCP\IConfig;
use PHPUnit\Framework\TestCase;
use ReflectionClass;

/**
 * Records every initial-state publication into the shared call log so the
 * shared listener test can assert script registration happens first.
 */
final class RecordingInitialState implements IInitialState
{
    public function __construct(private ArrayObject $order)
    {
    }

    public function provideInitialState(string $key, $data): void
    {
        $this->order[] = ['initialState', $key, $data];
    }

    public function provideLazyInitialState(string $key, Closure $closure): void
    {
        $this->order[] = ['lazyInitialState', $key, $closure];
    }
}

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

    public function testSharedHandlerRegistersTheScriptBeforePublishingWireState(): void
    {
        $order = new ArrayObject();
        $listener = new class($this->newConfig(), new RecordingInitialState($order), $order) extends AbstractScriptListener {
            public const SCRIPT_ASSET = 'files_readmemd-shared';

            private ArrayObject $order;

            public function __construct(Config $config, IInitialState $initialState, ArrayObject $order)
            {
                parent::__construct($config, $initialState);
                $this->order = $order;
            }

            protected function addScript(string $app, string $script): void
            {
                $this->order[] = ['addScript', $app, $script];
            }
        };

        $listener->handle(new Event());

        $calls = $order->getArrayCopy();
        self::assertCount(2, $calls);
        self::assertSame(['addScript', 'files_readmemd', 'files_readmemd-shared'], $calls[0]);
        self::assertSame('initialState', $calls[1][0]);
        self::assertSame('config', $calls[1][1]);
        self::assertSame('true', $calls[1][2]['show_asciidoc']);
        self::assertSame(['README', 'FEATURES'], $calls[1][2]['fileslist_footer']);
    }

    public function testApplicationRegistersTwoDistinctEventListeners(): void
    {
        $calls = [];
        $context = $this->createMock(IRegistrationContext::class);
        $context->expects(self::exactly(2))
            ->method('registerEventListener')
            ->willReturnCallback(function (string $event, string $listener, int $priority = 0) use (&$calls): void {
                $calls[] = [$event, $listener, $priority];
            });

        $application = (new ReflectionClass(Application::class))->newInstanceWithoutConstructor();
        $application->register($context);

        self::assertSame([
            ['OCA\\Files\\Event\\LoadAdditionalScriptsEvent', LoadAdditionalScriptsListener::class, 0],
            ['OCA\\Files_Sharing\\Event\\BeforeTemplateRenderedEvent', LoadAdditionalPublicScriptsListener::class, 0],
        ], $calls);
    }
}
