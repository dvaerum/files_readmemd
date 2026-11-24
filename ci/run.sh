#!/bin/sh
# Browser CI for files_readmemd. All setup goes through occ/WebDAV/OCS; Firefox
# only observes and screenshots. Works from a local checkout and from a fork's
# GitHub Actions runner with no session-specific tooling.
#
# Usage: ci/run.sh <setup|full|compat|negative|all|down|help>
set -eu

CI_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
APP_DIR=$(dirname "$CI_DIR")
COMPOSE_FILE="$CI_DIR/docker-compose.yml"

export CI_PROJECT="${CI_PROJECT:-files_readmemd-ci}"
export NEXTCLOUD_HOST_PORT="${NEXTCLOUD_HOST_PORT:-8290}"
export NC_ADMIN_USER="${NC_ADMIN_USER:-admin}"
export NC_ADMIN_PASSWORD="${NC_ADMIN_PASSWORD:-admin-password-please-change-me}"
export CI_UID="$(id -u)"
export CI_GID="$(id -g)"

PROJECT="$CI_PROJECT"
HOST_PORT="$NEXTCLOUD_HOST_PORT"
STACK_STARTED=0
WORKTREE_DIR=""
CLEANED=0

dc() { docker compose -f "$COMPOSE_FILE" -p "$PROJECT" "$@"; }
occ() { dc exec -T -u www-data app php /var/www/html/occ "$@"; }
fail() { echo "ci: $*" >&2; exit 1; }
http_code() { curl -sS -o /dev/null -w '%{http_code}' "$@"; }

cleanup() {
  status=$?
  [ "$CLEANED" -eq 1 ] && return 0
  CLEANED=1
  if [ "$status" -ne 0 ] && [ "$STACK_STARTED" -eq 1 ]; then
    echo "ci: failure — app log tail:" >&2
    dc logs --tail=80 app >&2 || true
  fi
  if [ "$STACK_STARTED" -eq 1 ] && [ "${KEEP_STACK:-0}" != "1" ]; then
    dc down -v --remove-orphans >/dev/null 2>&1 || true
  fi
  if [ -n "$WORKTREE_DIR" ]; then
    git -C "$APP_DIR" worktree remove --force "$WORKTREE_DIR" >/dev/null 2>&1 || true
    rm -rf "$WORKTREE_DIR"
  fi
  exit "$status"
}
trap cleanup EXIT

setup() {
  (cd "$APP_DIR" && npm ci && npm run build)
  (cd "$CI_DIR" && npm ci)
  echo "ci: app assets and Playwright package installed"
}

ensure_setup() {
  if [ ! -f "$CI_DIR/node_modules/@playwright/test/package.json" ]; then
    (cd "$CI_DIR" && npm ci)
  fi
  if ! ls "$APP_DIR"/js/files_readmemd-*.js >/dev/null 2>&1; then
    (cd "$APP_DIR" && npm ci && npm run build)
  fi
}

wait_for_pg() {
  i=0
  until dc exec -T db pg_isready -U nextcloud >/dev/null 2>&1; do
    i=$((i + 1)); [ "$i" -gt 30 ] && fail "database did not become ready"
    sleep 2
  done
  # Without this the image's PostgreSQL setup can switch to an oc_adminN role,
  # which breaks later installs when tables from an earlier run still exist.
  i=0
  until dc exec -T db psql -U nextcloud -d nextcloud -c \
    'ALTER ROLE nextcloud NOCREATEROLE' >/dev/null 2>&1; do
    i=$((i + 1)); [ "$i" -gt 30 ] && fail "could not fix database role privileges"
    sleep 2
  done
}

wait_for_nc() {
  i=0
  while [ "$i" -lt 120 ]; do
    if curl -fsS "http://localhost:${HOST_PORT}/status.php" >/dev/null 2>&1; then
      return 0
    fi
    i=$((i + 1)); sleep 2
  done
  fail "Nextcloud did not become ready on port $HOST_PORT"
}

start_stack() {
  export NEXTCLOUD_IMAGE="${NEXTCLOUD_IMAGE:-nextcloud:${NEXTCLOUD_VERSION}}"
  export APP_SOURCE="${APP_SOURCE:-$APP_DIR}"
  echo "ci: starting $NEXTCLOUD_VERSION on port $HOST_PORT"
  dc down -v --remove-orphans >/dev/null 2>&1 || true
  dc up -d db
  wait_for_pg
  dc up -d app
  wait_for_nc
  STACK_STARTED=1
}

stop_stack() {
  if [ "$STACK_STARTED" -eq 1 ]; then
    dc down -v --remove-orphans >/dev/null 2>&1 || true
    STACK_STARTED=0
  fi
}

app_enabled() { occ app:list --enabled | grep -q 'files_readmemd:'; }

check_wizard() {
  wizard=$(occ config:app:get firstrunwizard wizard_enabled)
  [ "$wizard" = "0" ] || fail "first-run wizard was not disabled (wizard_enabled=$wizard)"
}

upload_fixtures() {
  webdav="http://localhost:${HOST_PORT}/remote.php/dav/files/${NC_ADMIN_USER}"
  target=README-dev-fixtures

  # 405 means the folder already exists; the PUTs below are idempotent.
  for path in "$target" "$target/subfolder"; do
    code=$(http_code -u "$NC_ADMIN_USER:$NC_ADMIN_PASSWORD" -X MKCOL "$webdav/$path")
    case "$code" in 201|405) ;; *) fail "MKCOL $path returned HTTP $code" ;; esac
  done

  for file in README.md HEADER.md .README.md README.markdown HEADER.adoc README.html FEATURES.md; do
    [ -f "$CI_DIR/fixtures/$file" ] || fail "missing fixture $CI_DIR/fixtures/$file"
    code=$(http_code -u "$NC_ADMIN_USER:$NC_ADMIN_PASSWORD" \
      -T "$CI_DIR/fixtures/$file" "$webdav/$target/$file")
    case "$code" in 201|204) ;; *) fail "PUT $file returned HTTP $code" ;; esac
  done
  code=$(http_code -u "$NC_ADMIN_USER:$NC_ADMIN_PASSWORD" \
    -T "$CI_DIR/fixtures/subfolder/README.md" "$webdav/$target/subfolder/README.md")
  case "$code" in 201|204) ;; *) fail "PUT subfolder/README.md returned HTTP $code" ;; esac
}

create_share() {
  xml=$(curl -sS -u "$NC_ADMIN_USER:$NC_ADMIN_PASSWORD" -H 'OCS-APIRequest: true' \
    -X POST "http://localhost:${HOST_PORT}/ocs/v2.php/apps/files_sharing/api/v1/shares" \
    --data-urlencode 'path=/README-dev-fixtures' \
    --data-urlencode 'shareType=3' \
    --data-urlencode 'permissions=1')
  SHARE_TOKEN=$(printf '%s\n' "$xml" | python3 -c '
import sys, xml.etree.ElementTree as ET
root = ET.fromstring(sys.stdin.read())
if root.findtext("./meta/status") != "ok":
    sys.exit(1)
print(root.findtext("./data/token") or "")
')
  export SHARE_TOKEN
  [ -n "$SHARE_TOKEN" ] || fail "could not create a public share"
}

reset_config() {
  # Deleting first avoids --type=boolean, which stores "1" where the app's
  # API expects the strings "true"/"false".
  occ config:app:delete files_readmemd show_asciidoc >/dev/null 2>&1 || true
  occ config:app:delete files_readmemd show_html >/dev/null 2>&1 || true
  occ config:app:set files_readmemd show_asciidoc --value=false >/dev/null
  occ config:app:set files_readmemd show_html --value=false >/dev/null
  occ config:app:set files_readmemd show_title --value=true >/dev/null
  occ config:app:set files_readmemd yellow_back --value=true >/dev/null
  occ config:app:set files_readmemd auto_refresh --value=false >/dev/null
  occ config:app:set files_readmemd disable_workspace --value=true >/dev/null
  occ config:app:set files_readmemd fileslist_header --value='["HEADER"]' >/dev/null
  occ config:app:set files_readmemd fileslist_footer --value='["README"]' >/dev/null
}

apply_state() {
  reset_config
  case "$1" in
    default) ;;
    features)
      occ config:app:set files_readmemd fileslist_footer --value='["FEATURES"]' >/dev/null
      ;;
    engines-on)
      occ config:app:set files_readmemd show_asciidoc --value=true >/dev/null
      occ config:app:set files_readmemd show_html --value=true >/dev/null
      ;;
    filelist-extra)
      occ config:app:set files_readmemd fileslist_header --value='["HEADER","VISUALH"]' >/dev/null
      occ config:app:set files_readmemd fileslist_footer --value='["README","VISUALF"]' >/dev/null
      ;;
    *) fail "unknown CI state: $1" ;;
  esac
}

run_pw() {
  state_name="$1"
  spec="$2"
  export CI_STATE="$state_name"
  echo "ci: Firefox $spec @state=$state_name"
  set -- npx playwright test "$spec" --grep "@state=${state_name}"
  if [ "${UPDATE_BASELINES:-0}" = "1" ]; then
    set -- "$@" --update-snapshots
  fi
  dc run --rm playwright "$@"
}

full_profile() {
  export NEXTCLOUD_VERSION="${FULL_VERSION:-${NEXTCLOUD_VERSION:-29-apache}}"
  export NEXTCLOUD_IMAGE="${FULL_IMAGE:-${NEXTCLOUD_IMAGE:-}}"
  export APP_SOURCE="$APP_DIR"
  ensure_setup
  start_stack
  app_enabled || fail "app was not enabled by the boot hook"
  check_wizard
  upload_fixtures
  create_share
  for state_name in default features engines-on filelist-extra; do
    apply_state "$state_name"
    run_pw "$state_name" full.spec.js
  done
  apply_state default
  stop_stack
}

compat_profile() {
  ensure_setup
  for version in ${COMPAT_VERSIONS:-33-apache 34-apache 35-apache}; do
    export NEXTCLOUD_VERSION="$version"
    export NEXTCLOUD_IMAGE="${COMPAT_IMAGE:-nextcloud:$version}"
    export APP_SOURCE="$APP_DIR"
    start_stack
    check_wizard
    if app_enabled; then
      fail "app unexpectedly enabled on unsupported Nextcloud $version"
    fi
    run_pw compat compat.spec.js
    stop_stack
  done
}

negative_profile() {
  # Separate project and port so the negative control can run alongside a
  # normal full run without touching its volumes or browser context.
  CI_PROJECT="${CI_NEGATIVE_PROJECT:-files_readmemd-ci-negative}"
  PROJECT="$CI_PROJECT"
  NEXTCLOUD_HOST_PORT="${CI_NEGATIVE_PORT:-8291}"
  HOST_PORT="$NEXTCLOUD_HOST_PORT"
  export CI_PROJECT NEXTCLOUD_HOST_PORT

  export NEXTCLOUD_VERSION="${NEGATIVE_VERSION:-35-apache}"
  export NEXTCLOUD_IMAGE="${NEGATIVE_IMAGE:-nextcloud:${NEXTCLOUD_VERSION}}"
  ensure_setup

  # The unpatched upstream release the CI commit was based on. A repository's
  # root commit is often a much older, incompatible app, so do not derive it.
  base_sha="${BASE_SHA:-c31d8a243678b4f04348c40fca1e5a8e587a05aa}"
  git -C "$APP_DIR" cat-file -e "$base_sha^{commit}" 2>/dev/null \
    || fail "BASE_SHA $base_sha is not in this checkout; set BASE_SHA to the unpatched commit"
  echo "ci: negative control uses unpatched app at $base_sha"
  WORKTREE_DIR=$(mktemp -d "${TMPDIR:-/tmp}/files-readmemd-negative.XXXXXX")
  # mktemp is 0700; the container reads the mount as www-data (uid 33).
  chmod 755 "$WORKTREE_DIR"
  git -C "$APP_DIR" worktree add --detach "$WORKTREE_DIR" "$base_sha"

  export APP_SOURCE="$WORKTREE_DIR"
  start_stack
  check_wizard
  if app_enabled; then
    fail "unpatched app is already enabled on $NEXTCLOUD_VERSION"
  fi

  set +e
  output=$(occ app:enable files_readmemd 2>&1)
  status=$?
  set -e
  if [ "$status" -eq 0 ]; then
    fail "unpatched app was accepted by $NEXTCLOUD_VERSION"
  fi
  printf '%s\n' "$output" | grep -Eiq \
    'incompatible|not compatible|maximum|requires Nextcloud|cannot be installed' \
    || fail "enable failed for an unexpected reason: $output"
  echo "ci: negative control OK — unpatched app rejected on $NEXTCLOUD_VERSION"

  run_pw negative compat.spec.js
  stop_stack
}

all_profile() {
  full_profile
  compat_profile
  negative_profile
}

cmd="${1:-help}"
shift || true
case "$cmd" in
  setup) setup ;;
  full) full_profile ;;
  compat) compat_profile ;;
  negative) negative_profile ;;
  all) all_profile ;;
  down) stop_stack ;;
  help)
    cat <<EOF
Usage: ci/run.sh <command>

  setup      install app deps, build assets, install Playwright package
  full       full visual matrix on Nextcloud 29 (four configuration states)
  compat     smoke on Nextcloud 33/34/35 (app must not load there)
  negative   unpatched app at BASE_SHA must be rejected on Nextcloud 35
  all        setup + full + compat + negative
  down       stop and remove the CI stack volumes

Environment:
  FULL_VERSION, COMPAT_VERSIONS, NEGATIVE_VERSION  Nextcloud tags
  BASE_SHA        unpatched app commit (defaults to upstream v3.0.2 commit)
  UPDATE_BASELINES=1  regenerate committed screenshots in ci/baselines
  KEEP_STACK=1    leave the stack running for inspection
  NEXTCLOUD_HOST_PORT  host port (default 8290)
EOF
    ;;
  *) fail "unknown command '$cmd' (try: ci/run.sh help)" ;;
esac
