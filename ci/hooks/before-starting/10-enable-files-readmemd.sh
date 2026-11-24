#!/bin/sh
# Enable the app under development before Apache starts so visual tests never
# have to install it themselves. Hooks run as www-data after installation.
set -eu

occ="php /var/www/html/occ"
app_id="files_readmemd"

major="$($occ status --output=json | sed -n 's/.*"version":"\([0-9][0-9]*\).*/\1/p')"
if [ "$major" -gt 29 ]; then
  echo "Skipping $app_id: it supports Nextcloud 28-29, this is NC $major"
  exit 0
fi

$occ app:enable "$app_id"
