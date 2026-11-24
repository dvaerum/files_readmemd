#!/bin/sh
# Suppress the first-run wizard for every user so visual tests start on the
# plain Files/settings UI instead of a changelog/welcome modal.
set -eu

php /var/www/html/occ config:app:set firstrunwizard wizard_enabled \
  --value=false --type=boolean
