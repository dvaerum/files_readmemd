#!/bin/sh
# Browser CI for files_readmemd. All setup goes through occ/WebDAV/OCS; Firefox
# only observes and screenshots. Works from a local checkout and from a fork's
# GitHub Actions runner with no session-specific tooling.
#
# Usage: ci/run.sh <setup|full|compat|negative|all|down|shell-test|help>
set -eu

CI_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
APP_DIR=$(dirname "$CI_DIR")
COMPOSE_FILE="$CI_DIR/docker-compose.yml"
STAMP_FILE="$CI_DIR/.build-stamp"

. "$CI_DIR/lib/config.sh"
. "$CI_DIR/lib/lifecycle.sh"
. "$CI_DIR/lib/setup.sh"

fail() { ci_fail "$@"; }

# Read the env-driven switches with unset-safe defaults: assigning them here
# would clobber KEEP_STACK=1 / UPDATE_BASELINES=1 from the caller.
STACK_STARTED=0
WORKTREE_DIR=''
TEARDOWN_PROJECTS=''
CLEANED=0

cleanup() {
	status=$?
	[ "$CLEANED" -eq 1 ] && return 0
	CLEANED=1
	if [ "$status" -ne 0 ] && [ "$STACK_STARTED" -eq 1 ]; then
		echo "ci: failure — app log tail:" >&2
		for project in $TEARDOWN_PROJECTS; do
			# Log tail is best effort; it must not replace the original failure.
			if ! ci_compose "$COMPOSE_FILE" "$project" logs --tail=80 app >&2; then
				echo "ci: no logs for $project" >&2
			fi
		done
	fi
	if [ "${KEEP_STACK:-0}" = 1 ]; then
		echo 'ci: KEEP_STACK=1 — leaving stacks running'
	else
		for project in $TEARDOWN_PROJECTS; do
			# Report teardown trouble without masking the run's own exit status.
			if ! stack_down "$COMPOSE_FILE" "$project"; then
				echo "ci: teardown failed for $project" >&2
			fi
		done
	fi
	if [ -n "$WORKTREE_DIR" ]; then
		if ! git -C "$APP_DIR" worktree remove --force "$WORKTREE_DIR" >/dev/null 2>&1; then
			echo "ci: could not remove worktree $WORKTREE_DIR" >&2
		fi
		if ! rm -rf "$WORKTREE_DIR"; then
			echo "ci: could not remove temporary directory $WORKTREE_DIR" >&2
		fi
	fi
	exit "$status"
}
trap cleanup EXIT

setup_cmd() {
	ensure_assets "$APP_DIR" "$STAMP_FILE" "$BUILD_STAMP"
	ensure_playwright "$CI_DIR"
}

http_code() { curl -sS -o /dev/null -w '%{http_code}' "$@"; }

app_enabled() { occ "$COMPOSE_FILE" "$PROJECT" app:list --enabled | grep -q 'files_readmemd:'; }

check_wizard() {
	wizard=$(occ "$COMPOSE_FILE" "$PROJECT" config:app:get firstrunwizard wizard_enabled)
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
	[ -n "$SHARE_TOKEN" ] || fail 'could not create a public share'
}

reset_config() {
	# Deleting first avoids --type=boolean, which stores "1" where the app's
	# API expects the strings "true"/"false".
	occ "$COMPOSE_FILE" "$PROJECT" config:app:delete files_readmemd show_asciidoc >/dev/null 2>&1 || true
	occ "$COMPOSE_FILE" "$PROJECT" config:app:delete files_readmemd show_html >/dev/null 2>&1 || true
	occ "$COMPOSE_FILE" "$PROJECT" config:app:set files_readmemd show_asciidoc --value=false >/dev/null
	occ "$COMPOSE_FILE" "$PROJECT" config:app:set files_readmemd show_html --value=false >/dev/null
	occ "$COMPOSE_FILE" "$PROJECT" config:app:set files_readmemd show_title --value=true >/dev/null
	occ "$COMPOSE_FILE" "$PROJECT" config:app:set files_readmemd yellow_back --value=true >/dev/null
	occ "$COMPOSE_FILE" "$PROJECT" config:app:set files_readmemd auto_refresh --value=false >/dev/null
	occ "$COMPOSE_FILE" "$PROJECT" config:app:set files_readmemd disable_workspace --value=true >/dev/null
	occ "$COMPOSE_FILE" "$PROJECT" config:app:set files_readmemd fileslist_header --value='["HEADER"]' >/dev/null
	occ "$COMPOSE_FILE" "$PROJECT" config:app:set files_readmemd fileslist_footer --value='["README"]' >/dev/null
}

apply_state() {
	reset_config
	case "$1" in
		default) ;;
		features)
			occ "$COMPOSE_FILE" "$PROJECT" config:app:set files_readmemd fileslist_footer --value='["FEATURES"]' >/dev/null
			;;
		engines-on)
			occ "$COMPOSE_FILE" "$PROJECT" config:app:set files_readmemd show_asciidoc --value=true >/dev/null
			occ "$COMPOSE_FILE" "$PROJECT" config:app:set files_readmemd show_html --value=true >/dev/null
			;;
		filelist-extra)
			occ "$COMPOSE_FILE" "$PROJECT" config:app:set files_readmemd fileslist_header --value='["HEADER","VISUALH"]' >/dev/null
			occ "$COMPOSE_FILE" "$PROJECT" config:app:set files_readmemd fileslist_footer --value='["README","VISUALF"]' >/dev/null
			;;
		*) fail "unknown CI state: $1" ;;
	esac
}

run_pw() {
	state_name=$1
	spec=$2
	export CI_STATE="$state_name"
	echo "ci: Firefox $spec @state=$state_name"
	set -- npx playwright test "$spec" --grep "@state=${state_name}"
	if [ "${UPDATE_BASELINES:-0}" = 1 ]; then
		set -- "$@" --update-snapshots
	fi
	pw_run "$COMPOSE_FILE" "$PROJECT" "${UPDATE_BASELINES:-0}" "$@"
}

full_profile() {
	config=$(ci_config full)
	eval "$config"
	[ -n "$TEARDOWN_PROJECTS" ] || TEARDOWN_PROJECTS="$PROJECT"
	setup_cmd
	stack_up "$COMPOSE_FILE" "$PROJECT" "$HOST_PORT" "$NEXTCLOUD_VERSION" \
		"$NEXTCLOUD_IMAGE" "$APP_DIR"
	STACK_STARTED=1
	app_enabled || fail 'app was not enabled by the boot hook'
	check_wizard
	upload_fixtures
	create_share
	for state_name in $STATE_LIST; do
		apply_state "$state_name"
		run_pw "$state_name" full.spec.js
	done
	apply_state default
}

compat_profile() {
	last_version=${COMPAT_VERSIONS##* }
	for version in $COMPAT_VERSIONS; do
		config=$(ci_config compat "$version")
		eval "$config"
		[ -n "$TEARDOWN_PROJECTS" ] || TEARDOWN_PROJECTS="$PROJECT"
		setup_cmd
		stack_up "$COMPOSE_FILE" "$PROJECT" "$HOST_PORT" "$NEXTCLOUD_VERSION" \
			"$NEXTCLOUD_IMAGE" "$APP_DIR"
		STACK_STARTED=1
		check_wizard
		if app_enabled; then
			fail "app unexpectedly enabled on unsupported Nextcloud $version"
		fi
		run_pw compat compat.spec.js
		# The next version reuses this port, so free it before continuing.
		# The final stack is left to cleanup, which honours KEEP_STACK.
		if [ "$version" != "$last_version" ]; then
			stack_down "$COMPOSE_FILE" "$PROJECT"
			STACK_STARTED=0
		fi
	done
}

negative_profile() {
	config=$(ci_config negative)
	eval "$config"
	[ -n "$TEARDOWN_PROJECTS" ] || TEARDOWN_PROJECTS="$PROJECT"
	setup_cmd

	# The unpatched upstream release the CI commit was based on. A repository's
	# root commit is often a much older, incompatible app, so do not derive it.
	git -C "$APP_DIR" cat-file -e "$BASE_SHA^{commit}" 2>/dev/null \
		|| fail "BASE_SHA $BASE_SHA is not in this checkout; set BASE_SHA to the unpatched commit"
	echo "ci: negative control uses unpatched app at $BASE_SHA"
	WORKTREE_DIR=$(mktemp -d "${TMPDIR:-/tmp}/files-readmemd-negative.XXXXXX")
	# mktemp is 0700; the container reads the mount as www-data (uid 33).
	chmod 755 "$WORKTREE_DIR"
	git -C "$APP_DIR" worktree add --detach "$WORKTREE_DIR" "$BASE_SHA"

	stack_up "$COMPOSE_FILE" "$PROJECT" "$HOST_PORT" "$NEXTCLOUD_VERSION" \
		"$NEXTCLOUD_IMAGE" "$WORKTREE_DIR"
	STACK_STARTED=1
	check_wizard
	if app_enabled; then
		fail "unpatched app is already enabled on $NEXTCLOUD_VERSION"
	fi

	set +e
	output=$(occ "$COMPOSE_FILE" "$PROJECT" app:enable files_readmemd 2>&1)
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
}

all_profile() {
	config=$(ci_config all)
	eval "$config"
	TEARDOWN_PROJECTS="$PROJECT $NEGATIVE_PROJECT"
	echo 'ci: setup + full + compat + negative'
	setup_cmd
	full_profile
	# Compatibility reuses the full profile's port; only its final stack stays.
	stack_down "$COMPOSE_FILE" "$PROJECT"
	STACK_STARTED=0
	compat_profile
	negative_profile
}

down_cmd() {
	for project in $PROJECTS; do
		stack_status "$COMPOSE_FILE" "$project"
		stack_down "$COMPOSE_FILE" "$project"
	done
	TEARDOWN_PROJECTS=''
}

cmd=${1:-help}
case "$cmd" in
	setup|full|compat|negative|all|down)
		config=$(ci_config "$cmd")
		eval "$config"
		;;
	shell-test|help) ;;
	*) fail "unknown command '$cmd' (try: ci/run.sh help)" ;;
esac

case "$cmd" in
	setup) setup_cmd ;;
	full) full_profile ;;
	compat) compat_profile ;;
	negative) negative_profile ;;
	all) all_profile ;;
	down) down_cmd ;;
	shell-test) "$CI_DIR/tests/shell/run.sh" ;;
	help)
		cat <<EOF
Usage: ci/run.sh <command>

  setup       install app deps, build assets, install Playwright package
  full        full visual matrix on Nextcloud 29 (four configuration states)
  compat      smoke on Nextcloud 33/34/35 (app must not load there)
  negative    unpatched app at BASE_SHA must be rejected on Nextcloud 35
  all         setup + full + compat + negative
  down        stop and remove both CI project stacks and their volumes
  shell-test  config/lifecycle unit tests with a fake docker compose

Environment:
  FULL_VERSION, COMPAT_VERSIONS, NEGATIVE_VERSION  Nextcloud tags
  BASE_SHA        unpatched app commit (defaults to upstream v3.0.2 commit)
  UPDATE_BASELINES=1  the only switch that regenerates screenshots
  KEEP_STACK=1    leave the final stack(s) running for inspection
  NEXTCLOUD_HOST_PORT  host port (default 8290)
  CI_NEGATIVE_PORT     negative-control port (default 8291)
EOF
		;;
esac
