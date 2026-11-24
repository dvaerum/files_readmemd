<?php
declare(strict_types=1);

// Bootstrap for the unit tests. The php:apache image has no composer vendor
// dir — load the Nextcloud server's public interfaces and the app classes
// directly.
require_once '/var/www/html/lib/public/IConfig.php';
require_once '/var/www/html/lib/public/IRequest.php';
require_once '/var/www/html/lib/public/IL10N.php';
require_once '/var/www/html/lib/public/AppFramework/Controller.php';
require_once '/var/www/html/lib/public/Settings/ISettings.php';
require_once '/var/www/html/custom_apps/files_readmemd/lib/Services/Config.php';
require_once '/var/www/html/custom_apps/files_readmemd/lib/Controller/ConfigController.php';
require_once '/var/www/html/custom_apps/files_readmemd/lib/Settings/Admin/Engine.php';
