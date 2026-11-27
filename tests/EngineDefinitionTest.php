<?php
declare(strict_types=1);

namespace OCA\ReadmeMD\Tests;

use InvalidArgumentException;
use OCA\ReadmeMD\EngineDefinition;
use PHPUnit\Framework\TestCase;

/**
 * @covers \OCA\ReadmeMD\EngineDefinition
 */
class EngineDefinitionTest extends TestCase
{
    private function fixture(string $name): string
    {
        return dirname(__DIR__) . '/tests/fixtures/' . $name;
    }

    public function testDeclarationLoadsEnginesInDeclarationOrder(): void
    {
        $engines = new EngineDefinition(dirname(__DIR__) . '/engines.json');

        self::assertSame(['markdown', 'asciidoc', 'html'], $engines->ids());
        self::assertSame([
            'extensions' => ['md', 'markdown'],
            'wireKey' => null,
            'wireDefault' => true,
            'alwaysOn' => true,
            'adminControlId' => 'readmeMD-engine-markdown',
        ], $engines->get('markdown'));
        self::assertSame(['adoc', 'asciidoc'], $engines->extensions('asciidoc'));
        self::assertSame('show_html', $engines->wireKey('html'));
        self::assertFalse($engines->wireDefault('html'));
        self::assertTrue($engines->isAlwaysOn('markdown'));
        self::assertFalse($engines->isAlwaysOn('asciidoc'));
        self::assertSame('readmeMD-engine-html', $engines->adminControlId('html'));
    }

    public function testRankIsDerivedFromDeclarationOrder(): void
    {
        $engines = new EngineDefinition(dirname(__DIR__) . '/engines.json');

        self::assertSame(1, $engines->rank('markdown'));
        self::assertSame(2, $engines->rank('asciidoc'));
        self::assertSame(3, $engines->rank('html'));
        self::assertSame(['show_asciidoc', 'show_html'], $engines->wireKeys());
    }

    public function testEveryFieldHasAnExhaustiveReverseLookup(): void
    {
        $engines = new EngineDefinition(dirname(__DIR__) . '/engines.json');

        self::assertSame('asciidoc', $engines->idForWireKey('show_asciidoc'));
        self::assertSame('html', $engines->idForWireKey('show_html'));
        self::assertSame('markdown', $engines->idForAdminControlId('readmeMD-engine-markdown'));
        self::assertSame('html', $engines->idForExtension('htm'));
        self::assertSame('asciidoc', $engines->idForExtension('asciidoc'));
        self::assertTrue($engines->hasExtension('markdown'));
        self::assertFalse($engines->hasExtension('txt'));
        self::assertTrue($engines->has('html'));
        self::assertFalse($engines->has('sidecar'));
    }

    public function testUnknownEngineAndValueFailLoudly(): void
    {
        $engines = new EngineDefinition(dirname(__DIR__) . '/engines.json');

        try {
            $engines->get('sidecar');
            self::fail('unknown engine id was accepted');
        } catch (InvalidArgumentException $e) {
            self::assertStringContainsString('sidecar', $e->getMessage());
        }

        try {
            $engines->idForWireKey('show_sidecar');
            self::fail('unknown wire key was accepted');
        } catch (InvalidArgumentException $e) {
            self::assertStringContainsString('show_sidecar', $e->getMessage());
        }
    }

    /** @dataProvider invalidDeclarations */
    public function testInvalidDeclarationsFailLoudly(string $file, string $expected): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage($expected);
        new EngineDefinition($this->fixture($file));
    }

    /** @return array<string, array{string, string}> */
    public static function invalidDeclarations(): array
    {
        return [
            'missing field' => ['engines-missing-field.json', 'wireKey'],
            'duplicate extension' => ['engines-duplicate-extension.json', 'md'],
            'empty extensions' => ['engines-empty-extensions.json', 'extensions'],
            'list instead of object' => ['engines-list.json', 'object'],
            'optional engine without wire key' => ['engines-no-wire-key.json', 'wireKey'],
            'duplicate admin control' => ['engines-duplicate-control.json', 'readmeMD-engine-html'],
            'empty engine id' => ['engines-empty-id.json', 'empty engine id'],
            'no engines' => ['engines-empty.json', 'no engines'],
        ];
    }

    public function testMissingFileFailsLoudly(): void
    {
        $this->expectException(\RuntimeException::class);
        new EngineDefinition($this->fixture('engines-absent.json'));
    }
}
