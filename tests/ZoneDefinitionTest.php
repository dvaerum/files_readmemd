<?php
declare(strict_types=1);

namespace OCA\ReadmeMD\Tests;

use InvalidArgumentException;
use OCA\ReadmeMD\ZoneDefinition;
use PHPUnit\Framework\TestCase;

/**
 * @covers \OCA\ReadmeMD\ZoneDefinition
 */
class ZoneDefinitionTest extends TestCase
{
    private function fixture(string $name): string
    {
        return dirname(__DIR__) . '/tests/fixtures/' . $name;
    }

    public function testDeclarationLoadsBothZones(): void
    {
        $zones = new ZoneDefinition(dirname(__DIR__) . '/zones.json');

        self::assertSame(['headermd', 'footermd'], $zones->ids());
        self::assertSame([
            'adminToken' => 'header',
            'configKey' => 'fileslist_header',
            'domClass' => 'headermd',
            'endpointSegment' => 'header',
        ], $zones->get('headermd'));
        self::assertSame('footer', $zones->field('footermd', 'adminToken'));
        self::assertSame('fileslist_footer', $zones->field('footermd', 'configKey'));
    }

    public function testEveryFieldHasAnExhaustiveReverseLookup(): void
    {
        $zones = new ZoneDefinition(dirname(__DIR__) . '/zones.json');

        self::assertSame('headermd', $zones->idForAdminToken('header'));
        self::assertSame('footermd', $zones->idForAdminToken('footer'));
        self::assertSame('headermd', $zones->idForConfigKey('fileslist_header'));
        self::assertSame('footermd', $zones->idForConfigKey('fileslist_footer'));
        self::assertSame('headermd', $zones->idForDomClass('headermd'));
        self::assertSame('footermd', $zones->idForDomClass('footermd'));
        self::assertSame('headermd', $zones->idForEndpointSegment('header'));
        self::assertSame('footermd', $zones->idForEndpointSegment('footer'));

        self::assertTrue($zones->has('headermd'));
        self::assertFalse($zones->has('sidermd'));
        self::assertTrue($zones->hasAdminToken('footer'));
        self::assertFalse($zones->hasAdminToken('side'));
    }

    public function testUnknownZoneAndUnknownValueFailLoudly(): void
    {
        $zones = new ZoneDefinition(dirname(__DIR__) . '/zones.json');

        try {
            $zones->get('sidermd');
            self::fail('unknown zone id was accepted');
        } catch (InvalidArgumentException $e) {
            self::assertStringContainsString('sidermd', $e->getMessage());
        }

        try {
            $zones->idForDomClass('anywhere');
            self::fail('unknown dom class was accepted');
        } catch (InvalidArgumentException $e) {
            self::assertStringContainsString('anywhere', $e->getMessage());
        }
    }

    /** @dataProvider invalidDeclarations */
    public function testInvalidDeclarationsFailLoudly(string $file, string $expected): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage($expected);
        new ZoneDefinition($this->fixture($file));
    }

    /** @return array<string, array{string, string}> */
    public static function invalidDeclarations(): array
    {
        return [
            'missing field' => ['zones-missing-field.json', 'endpointSegment'],
            'duplicate field value' => ['zones-duplicate-key.json', 'fileslist_header'],
            'empty field value' => ['zones-empty-field.json', 'endpointSegment'],
            'list instead of object' => ['zones-list.json', 'object'],
        ];
    }

    public function testMissingFileFailsLoudly(): void
    {
        $this->expectException(\RuntimeException::class);
        new ZoneDefinition($this->fixture('zones-absent.json'));
    }
}
