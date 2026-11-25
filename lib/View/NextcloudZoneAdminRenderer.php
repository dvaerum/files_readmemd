<?php
declare(strict_types=1);

namespace OCA\ReadmeMD\View;

use OCP\IL10N;

/**
 * Production renderer adapter: Nextcloud translations and template escaping.
 */
final class NextcloudZoneAdminRenderer implements ZoneAdminRenderer
{
    private IL10N $translator;

    public function __construct(IL10N $translator)
    {
        $this->translator = $translator;
    }

    public function translate(string $text): string
    {
        return (string) $this->translator->t($text);
    }

    public function escape(string $value): string
    {
        return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }
}
