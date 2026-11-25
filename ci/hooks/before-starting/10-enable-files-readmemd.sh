#!/bin/sh
# Enable the app under development before Apache starts so visual tests never
# have to install it themselves. Hooks run as www-data after installation.
# The support decision comes from the mounted app's info.xml through the same
# parser the CI harness and divergence test use.
set -eu

occ="php /var/www/html/occ"
app_id="files_readmemd"
info="/var/www/html/custom_apps/files_readmemd/appinfo/info.xml"
parser="/readmemd-ci-lib/support-range.sh"

# The dev stack does not mount the CI lib separately; the app checkout carries
# the same parser. CI mounts it explicitly so the negative control's older
# worktree cannot remove the parser.
[ -f "$parser" ] || parser="/var/www/html/custom_apps/files_readmemd/ci/lib/support-range.sh"
. "$parser"

major="$($occ status --output=json | sed -n 's/.*"version":"\([0-9][0-9]*\).*/\1/p')"
[ -n "$major" ] || { echo "Could not read Nextcloud version" >&2; exit 1; }

if support_allows "$major" "$info"; then
  $occ app:enable "$app_id"
else
  echo "Skipping $app_id: supports Nextcloud $(support_range_min "$info")-$(support_range_max "$info"), this is NC $major"
fi
