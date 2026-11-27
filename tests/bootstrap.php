<?php
declare(strict_types=1);

// Bootstrap for the unit tests. The server image has no composer vendor dir,
// so its public interfaces and the app classes are loaded directly. Defaults
// are derived from this file's location; the env vars override them when the
// app runs outside a standard Nextcloud installation.
$ncRoot = getenv('NEXTCLOUD_ROOT') ?: dirname(__DIR__, 3);
$appRoot = getenv('APP_ROOT') ?: dirname(__DIR__);

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
    $ncRoot . '/3rdparty/psr/event-dispatcher/src/StoppableEventInterface.php',
    $ncRoot . '/lib/public/EventDispatcher/Event.php',
    $ncRoot . '/lib/public/EventDispatcher/IEventListener.php',
    $ncRoot . '/lib/public/AppFramework/Services/IInitialState.php',
    $ncRoot . '/lib/public/AppFramework/App.php',
    $ncRoot . '/lib/public/AppFramework/Bootstrap/IBootstrap.php',
    $ncRoot . '/lib/public/AppFramework/Bootstrap/IBootContext.php',
    $ncRoot . '/lib/public/AppFramework/Bootstrap/IRegistrationContext.php',
    $ncRoot . '/lib/public/Util.php',
    $appRoot . '/lib/ZoneDefinition.php',
    $appRoot . '/lib/EngineDefinition.php',
    $appRoot . '/lib/Services/Config.php',
    $appRoot . '/lib/Services/ConfigSnapshot.php',
    $appRoot . '/lib/View/ZoneAdminRenderer.php',
    $appRoot . '/lib/View/NextcloudZoneAdminRenderer.php',
    $appRoot . '/lib/View/ZoneAdminView.php',
    $appRoot . '/lib/Controller/ConfigController.php',
    $appRoot . '/lib/AppInfo/Application.php',
    $appRoot . '/lib/Listeners/AbstractScriptListener.php',
    $appRoot . '/lib/Listeners/LoadAdditionalScriptsListener.php',
    $appRoot . '/lib/Listeners/LoadAdditionalPublicScriptsListener.php',
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
