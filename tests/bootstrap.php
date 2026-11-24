<?php
declare(strict_types=1);

// Bootstrap for the unit tests. The php:apache image has no composer vendor
// dir, so the server's public interfaces and the app classes are loaded
// directly. Paths are overridable so the same tests run outside that container.
$ncRoot = getenv('NEXTCLOUD_ROOT') ?: '/var/www/html';
$appRoot = getenv('APP_ROOT') ?: $ncRoot . '/custom_apps/files_readmemd';

$files = [
    $ncRoot . '/lib/public/IConfig.php',
    $ncRoot . '/lib/public/IRequest.php',
    $ncRoot . '/lib/public/IL10N.php',
    $ncRoot . '/lib/public/AppFramework/Controller.php',
    $ncRoot . '/lib/public/AppFramework/Http.php',
    $ncRoot . '/lib/public/AppFramework/Http/EmptyContentSecurityPolicy.php',
    $ncRoot . '/lib/public/AppFramework/Http/ContentSecurityPolicy.php',
    $ncRoot . '/lib/public/AppFramework/Http/Response.php',
    $ncRoot . '/lib/public/AppFramework/Http/EmptyFeaturePolicy.php',
    $ncRoot . '/lib/public/AppFramework/Http/FeaturePolicy.php',
    $ncRoot . '/lib/public/AppFramework/Http/TemplateResponse.php',
    $ncRoot . '/lib/public/Settings/ISettings.php',
    $appRoot . '/lib/ZoneDefinition.php',
    $appRoot . '/lib/Services/Config.php',
    $appRoot . '/lib/Services/ConfigSnapshot.php',
    $appRoot . '/lib/Controller/ConfigController.php',
    $appRoot . '/lib/Settings/Admin/Engine.php',
];

foreach ($files as $file) {
    if (!is_file($file)) {
        fwrite(STDERR, "tests/bootstrap.php: missing $file (set NEXTCLOUD_ROOT and APP_ROOT)\n");
        exit(1);
    }
}

foreach ($files as $file) {
    require_once $file;
}
