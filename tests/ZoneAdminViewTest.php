<?php
declare(strict_types=1);

namespace OCA\ReadmeMD\Tests;

use OCA\ReadmeMD\Services\ConfigSnapshot;
use OCA\ReadmeMD\View\NextcloudZoneAdminRenderer;
use OCA\ReadmeMD\View\ZoneAdminRenderer;
use OCA\ReadmeMD\View\ZoneAdminView;
use OCA\ReadmeMD\ZoneDefinition;
use OCP\IL10N;
use PHPUnit\Framework\TestCase;

/**
 * Recording adapter: marks every translated and escaped value so the assertions
 * see the renderer seam, not just the final HTML.
 */
final class RecordingZoneAdminRenderer implements ZoneAdminRenderer
{
    /** @var list<string> */
    public array $translated = [];

    /** @var list<string> */
    public array $escaped = [];

    public function translate(string $text): string
    {
        $this->translated[] = $text;

        return 'T:' . $text;
    }

    public function escape(string $value): string
    {
        $this->escaped[] = $value;

        return 'E:' . $value;
    }
}

/**
 * @covers \OCA\ReadmeMD\View\ZoneAdminView
 * @covers \OCA\ReadmeMD\View\NextcloudZoneAdminRenderer
 */
class ZoneAdminViewTest extends TestCase
{
    private function newView(RecordingZoneAdminRenderer $renderer): ZoneAdminView
    {
        $zones = new ZoneDefinition(dirname(__DIR__) . '/zones.json');
        $snapshot = new ConfigSnapshot([
            'fileslist_header' => '["HEADER<X>"]',
            'fileslist_footer' => '["FOOT"]',
        ], $zones);

        return new ZoneAdminView($snapshot, $renderer);
    }

    public function testRenderFollowsZoneOrderWithOneListItemPrefix(): void
    {
        $html = $this->newView(new RecordingZoneAdminRenderer())->render();

        self::assertLessThan(
            (int) strpos($html, 'id="readmeMD-filelist_create-E:footer"'),
            (int) strpos($html, 'id="readmeMD-filelist_create-E:header"')
        );
        self::assertStringContainsString('id="readmeMD-filelist_create-E:header"', $html);
        self::assertStringContainsString('id="readmeMD-filelist_create-E:footer"', $html);
        self::assertSame(2, substr_count($html, 'id="readmeMD-filelist-E:'));
        self::assertStringContainsString('id="readmeMD-filelist-E:HEADER<X>"', $html);
        self::assertStringContainsString('id="readmeMD-filelist-E:FOOT"', $html);
        self::assertStringContainsString('data-zone="E:header" data-filename="E:HEADER<X>"', $html);
        self::assertStringContainsString('data-zone="E:footer" data-filename="E:FOOT"', $html);
    }

    public function testAllDynamicValuesCrossTheRendererAdapter(): void
    {
        $renderer = new RecordingZoneAdminRenderer();
        $this->newView($renderer)->render();

        self::assertContains('header', $renderer->escaped);
        self::assertContains('footer', $renderer->escaped);
        self::assertContains('HEADER<X>', $renderer->escaped);
        self::assertContains('FOOT', $renderer->escaped);
        self::assertContains('T:HEADER base filenames : ', $renderer->escaped);
        self::assertContains('T:HEADER base Name', $renderer->escaped);
        self::assertContains('T:FOOTER base filenames : ', $renderer->escaped);
        self::assertContains('T:Add', $renderer->escaped);

        self::assertContains('HEADER base filenames : ', $renderer->translated);
        self::assertContains('HEADER base Name', $renderer->translated);
        self::assertContains('FOOTER base filenames : ', $renderer->translated);
        self::assertContains('FOOTER base Name', $renderer->translated);
        self::assertContains('Add', $renderer->translated);
    }

    public function testBaseNameResponseComesFromDeclaredSemantics(): void
    {
        $view = $this->newView(new RecordingZoneAdminRenderer());

        self::assertNull($view->baseNameResponse('header'));
        self::assertSame('success', $view->baseNameResponse('footer'));
        self::assertNull($view->baseNameResponse('side'));
    }

    public function testProductionRendererTranslatesAndEscapes(): void
    {
        $translator = $this->createMock(IL10N::class);
        $translator->method('t')->willReturnCallback(
            static fn (string $text): string => 'translated:' . $text
        );
        $renderer = new NextcloudZoneAdminRenderer($translator);

        self::assertSame('translated:Add', $renderer->translate('Add'));
        self::assertSame('&lt;a &quot;x&quot;&gt;', $renderer->escape('<a "x">'));
    }
}
