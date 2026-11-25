<?php
declare(strict_types=1);

namespace OCA\ReadmeMD\View;

/**
 * Renderer adapters for the admin settings view.
 *
 * Translation and escaping are the only platform behaviour the view needs;
 * production supplies Nextcloud's IL10N and HTML escaping, tests supply a
 * local fake. No zone spelling or response rule crosses this seam.
 */
interface ZoneAdminRenderer
{
    public function translate(string $text): string;

    public function escape(string $value): string;
}
