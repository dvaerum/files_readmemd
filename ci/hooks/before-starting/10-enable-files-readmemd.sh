#!/bin/sh
# Enable the app under development before Apache starts so visual tests never
# have to install it themselves. Hooks run as www-data after installation.
# The support decision comes from the mounted app's info.xml through the one
# executable Support range module the CI harness also uses.
set -eu

occ="php /var/www/html/occ"
app_id="files_readmemd"
info="/var/www/html/custom_apps/files_readmemd/appinfo/info.xml"
parser="/readmemd-ci-lib/support-range.sh"

# The dev stack does not mount the CI lib separately; the app checkout carries
# the same module. CI mounts it explicitly so the negative control's older
# worktree cannot remove the decision.
[ -f "$parser" ] || parser="/var/www/html/custom_apps/files_readmemd/ci/lib/support-range.sh"
exec sh "$parser" enable --app "$app_id" --info "$info" --occ "$occ"
