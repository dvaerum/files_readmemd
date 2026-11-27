#!/bin/sh
# Unit tests for ci/lib/*. No Docker daemon or browser is needed: docker and npm
# are replaced with small executables that record their arguments.
set -eu

CI_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
. "$CI_DIR/lib/config.sh"
. "$CI_DIR/lib/lifecycle.sh"
. "$CI_DIR/lib/setup.sh"

tmp=$(mktemp -d "${TMPDIR:-/tmp}/readmemd-ci-shell.XXXXXX")
trap 'rm -rf "$tmp"' EXIT
bin="$tmp/bin"
mkdir -p "$bin"
export CI_DIR PATH="$bin:$PATH"

assert_eq() {
	if [ "$2" != "$3" ]; then
		ci_fail "$1: expected [$2], got [$3]"
	fi
	printf 'ok %s\n' "$1"
}

assert_has() {
	case "$2" in
		*"$1"*) printf 'ok %s\n' "$3" ;;
		*) ci_fail "$3: [$2] does not contain [$1]" ;;
	esac
}

assert_not_has() {
	case "$2" in
		*"$1"*) ci_fail "$3: [$2] unexpectedly contains [$1]" ;;
		*) printf 'ok %s\n' "$3" ;;
	esac
}

# Deterministic config output regardless of the caller's environment.
unset CI_PROJECT CI_NEGATIVE_PROJECT NEXTCLOUD_HOST_PORT CI_NEGATIVE_PORT
unset KEEP_STACK UPDATE_BASELINES FULL_VERSION NEXTCLOUD_VERSION COMPAT_VERSIONS
unset NEGATIVE_VERSION BASE_SHA FULL_IMAGE COMPAT_IMAGE NEGATIVE_IMAGE NEXTCLOUD_IMAGE
unset NC_ADMIN_USER NC_ADMIN_PASSWORD

# The support declaration is the source of truth for the hook, CI expectations
# and docs. Parse it here so a drift in any of those copies fails this suite.
app_info="$CI_DIR/../appinfo/info.xml"
set -- $(support_range "$app_info")
support_min=${1:-}
support_max=${2:-}
[ -n "$support_min" ] && [ -n "$support_max" ] ||
	ci_fail "could not parse support range from $app_info"
printf 'ok support range from info.xml: %s-%s\n' "$support_min" "$support_max"
support_allows "$support_min" "$app_info" || ci_fail "minimum version $support_min is not allowed"
support_allows "$support_max" "$app_info" || ci_fail "maximum version $support_max is not allowed"
if support_allows "$((support_min - 1))" "$app_info"; then
	ci_fail 'version below the declared minimum was allowed'
fi
if support_allows "$((support_max + 1))" "$app_info"; then
	ci_fail 'version above the declared maximum was allowed'
fi
printf 'ok support range boundaries\n'

# The browser harness runs in its own container, so every declaration is
# copied into ci/. A copied file must never be a second source of truth.
for declaration in zones.json engines.json; do
	app_declaration="$CI_DIR/../$declaration"
	ci_declaration="$CI_DIR/$declaration"
	[ -f "$ci_declaration" ] || ci_fail "missing CI declaration copy: $declaration"
	if ! cmp -s "$app_declaration" "$ci_declaration"; then
		ci_fail "$declaration differs from the app declaration; sync the CI copy"
	fi
	printf 'ok %s parity with app declaration\n' "$declaration"
done

full_config=$(ci_config full)
assert_has "export PROJECT='files_readmemd-ci'" "$full_config" 'full project'
assert_has "export CI_PROJECT='files_readmemd-ci'" "$full_config" 'full compose project'
assert_has "export HOST_PORT='8290'" "$full_config" 'full port'
assert_has "export NEXTCLOUD_HOST_PORT='8290'" "$full_config" 'full compose port'
assert_has "export NEXTCLOUD_VERSION='29-apache'" "$full_config" 'full version'
assert_has "export NEXTCLOUD_IMAGE='nextcloud:29-apache'" "$full_config" 'full image'
assert_has "export STATE_LIST='default features engines-on filelist-extra'" "$full_config" 'full states'
assert_has "export KEEP_STACK='0'" "$full_config" 'keep-stack default'
assert_has "export UPDATE_BASELINES='0'" "$full_config" 'baseline default'
assert_has "export SUPPORT_MIN='$support_min'" "$full_config" 'config exports declared minimum'
assert_has "export SUPPORT_MAX='$support_max'" "$full_config" 'config exports declared maximum'

# The executable decision is the test surface. Boundary outcomes and the boot
# hook's enable call are exercised through it, not by grepping call-site source.
support="$CI_DIR/lib/support-range.sh"
for version in "$support_min" "$support_max"; do
	assert_eq "expectation enabled at $version" enabled \
		"$(sh "$support" expectation --info "$app_info" --version "${version}-apache")"
done
for version in "$((support_min - 1))" "$((support_max + 1))"; do
	assert_eq "expectation disabled at $version" disabled \
		"$(sh "$support" expectation --info "$app_info" --version "${version}-apache")"
done

occ_log="$tmp/occ.log"
: > "$occ_log"
cat > "$bin/occ" <<'EOF'
#!/bin/sh
if [ "$1" = status ]; then
	printf '{"version":"%s","versionstring":"%s"}\n' "$FAKE_NC_VERSION" "$FAKE_NC_VERSION"
elif [ "$1" = app:enable ]; then
	printf '%s\n' "$*" >> "$FAKE_OCC_LOG"
fi
EOF
chmod +x "$bin/occ"
export FAKE_OCC_LOG="$occ_log"

FAKE_NC_VERSION="$support_min"
export FAKE_NC_VERSION
sh "$support" enable --app files_readmemd --info "$app_info" --occ "$bin/occ" >/dev/null
assert_has 'app:enable files_readmemd' "$(cat "$occ_log")" 'boot decision enables a supported app'

: > "$occ_log"
FAKE_NC_VERSION="$((support_max + 1))"
skip_output=$(sh "$support" enable --app files_readmemd --info "$app_info" --occ "$bin/occ")
assert_eq 'boot decision skips an unsupported app' '' "$(cat "$occ_log")"
assert_has 'Skipping files_readmemd' "$skip_output" 'boot decision prints the skip reason'
unset FAKE_NC_VERSION

app_readme=$(cat "$CI_DIR/../README.md")
ci_readme=$(cat "$CI_DIR/README.md")
assert_has "Nextcloud $support_min–$support_max" "$app_readme" 'app README states the declared range'
assert_has "Nextcloud $support_min–$support_max" "$ci_readme" 'CI README states the declared range'

negative_config=$(ci_config negative)
assert_has "export PROJECT='files_readmemd-ci-negative'" "$negative_config" 'negative project'
assert_has "export CI_PROJECT='files_readmemd-ci-negative'" "$negative_config" 'negative compose project'
assert_has "export HOST_PORT='8291'" "$negative_config" 'negative port'
assert_has "export NEXTCLOUD_HOST_PORT='8291'" "$negative_config" 'negative compose port'
assert_has "export NEXTCLOUD_VERSION='35-apache'" "$negative_config" 'negative version'
assert_has "export BASE_SHA='c31d8a243678b4f04348c40fca1e5a8e587a05aa'" "$negative_config" 'negative base sha'

all_config=$(ci_config all)
assert_has "export PROJECTS='files_readmemd-ci files_readmemd-ci-negative'" "$all_config" 'all projects'

KEEP_STACK=1 UPDATE_BASELINES=1 CI_NEGATIVE_PORT=8391
export KEEP_STACK UPDATE_BASELINES CI_NEGATIVE_PORT
override_config=$(ci_config negative)
assert_has "export HOST_PORT='8391'" "$override_config" 'negative port override'
assert_has "export NEXTCLOUD_HOST_PORT='8391'" "$override_config" 'negative compose port override'
assert_has "export KEEP_STACK='1'" "$override_config" 'keep-stack override'
assert_has "export UPDATE_BASELINES='1'" "$override_config" 'baseline override'
unset KEEP_STACK UPDATE_BASELINES CI_NEGATIVE_PORT

docker_log="$tmp/docker.log"
npm_log="$tmp/npm.log"
export FAKE_DOCKER_LOG="$docker_log" FAKE_NPM_LOG="$npm_log" FAKE_PS_CONTAINERS=''
export FAKE_VOLUMES='files_readmemd-ci_db_29-apache files_readmemd-ci-negative_db_29-apache'
: > "$docker_log"
: > "$npm_log"

cat > "$bin/docker" <<'EOF'
#!/bin/sh
printf 'project=%s args=%s\n' "$CI_PROJECT" "$*" >> "$FAKE_DOCKER_LOG"
if [ "$1" = compose ] && [ "$6" = ps ]; then
	printf '%s\n' $FAKE_PS_CONTAINERS
elif [ "$1" = volume ] && [ "$2" = ls ]; then
	printf '%s\n' $FAKE_VOLUMES
fi
EOF
cat > "$bin/npm" <<'EOF'
#!/bin/sh
printf '%s\n' "$*" >> "$FAKE_NPM_LOG"
if [ "$1" = run ] && [ "$2" = build ]; then
	mkdir -p js
	: > js/files_readmemd-main.js
fi
EOF
chmod +x "$bin/docker" "$bin/npm"

FAKE_PS_CONTAINERS='abc
def'
status=$(stack_status "$CI_DIR/docker-compose.yml" files_readmemd-ci)
assert_eq 'stack_status running' 'files_readmemd-ci running (2 containers)' "$status"

FAKE_PS_CONTAINERS=''
status=$(stack_status "$CI_DIR/docker-compose.yml" files_readmemd-ci)
assert_eq 'stack_status stopped' 'files_readmemd-ci stopped' "$status"

: > "$docker_log"
stack_down "$CI_DIR/docker-compose.yml" files_readmemd-ci >/dev/null
assert_has 'project=files_readmemd-ci args=compose -f' "$(cat "$docker_log")" 'stack_down project binding'
assert_has '-p files_readmemd-ci down -v --remove-orphans' "$(cat "$docker_log")" 'stack_down arguments'
assert_has 'volume rm files_readmemd-ci_db_29-apache' "$(cat "$docker_log")" 'stack_down removes own volumes'
assert_not_has 'volume rm files_readmemd-ci-negative' "$(cat "$docker_log")" 'stack_down leaves other project volumes'

# A stack must hand the same compose configuration to every later command in
# its profile; otherwise Playwright recreates the app after readiness passed.
cat > "$bin/curl" <<'EOF'
#!/bin/sh
exit 0
EOF
chmod +x "$bin/curl"
app_source="$tmp/stack-app"
mkdir -p "$app_source"
stack_up "$CI_DIR/docker-compose.yml" files_readmemd-ci 8290 29-apache \
	nextcloud:29-apache "$app_source" >/dev/null
assert_eq 'stack_up keeps the app mount for later compose commands' \
	"$app_source" "$APP_SOURCE"
assert_eq 'stack_up keeps the version for later compose commands' \
	'29-apache' "$NEXTCLOUD_VERSION"
assert_eq 'stack_up keeps the host port for later compose commands' \
	'8290' "$NEXTCLOUD_HOST_PORT"
unset APP_SOURCE NEXTCLOUD_VERSION NEXTCLOUD_HOST_PORT NEXTCLOUD_IMAGE

app="$tmp/app"
mkdir -p "$app/src"
printf 'export default 1\n' > "$app/src/index.js"
printf '{}\n' > "$app/package.json"
printf '{}\n' > "$app/package-lock.json"
printf 'module.exports = {}\n' > "$app/webpack.js"

stamp=$(ci_build_stamp "$app")
stamp_file="$tmp/build-stamp"
ensure_assets "$app" "$stamp_file" "$stamp" >/dev/null
assert_eq 'initial asset build' 2 "$(wc -l < "$npm_log" | tr -d ' ')"
assert_eq 'build stamp saved' "$stamp" "$(cat "$stamp_file")"

ensure_assets "$app" "$stamp_file" "$stamp" >/dev/null
assert_eq 'fresh assets skipped' 2 "$(wc -l < "$npm_log" | tr -d ' ')"

printf '// changed\n' >> "$app/src/index.js"
changed_stamp=$(ci_build_stamp "$app")
if [ "$changed_stamp" = "$stamp" ]; then
	ci_fail 'build stamp did not change with source'
fi
printf 'ok build stamp tracks source\n'
ensure_assets "$app" "$stamp_file" "$changed_stamp" >/dev/null
assert_eq 'changed source rebuilt' 4 "$(wc -l < "$npm_log" | tr -d ' ')"

printf '{"headermd":{}}\n' > "$app/zones.json"
zones_stamp=$(ci_build_stamp "$app")
if [ "$zones_stamp" = "$changed_stamp" ]; then
	ci_fail 'build stamp did not change with zone declaration'
fi
printf 'ok build stamp tracks zone declaration\n'

ci_dir_copy="$tmp/ci-zones"
mkdir -p "$ci_dir_copy"
sync_zone_declaration "$app" "$ci_dir_copy"
assert_eq 'zone declaration synced to CI harness' '{"headermd":{}}' "$(cat "$ci_dir_copy/zones.json")"

printf '{"markdown":{}}\n' > "$app/engines.json"
engine_stamp=$(ci_build_stamp "$app")
if [ "$engine_stamp" = "$zones_stamp" ]; then
	ci_fail 'build stamp did not change with engine declaration'
fi
printf 'ok build stamp tracks engine declaration\n'

sync_engine_declaration "$app" "$ci_dir_copy"
assert_eq 'engine declaration synced to CI harness' '{"markdown":{}}' "$(cat "$ci_dir_copy/engines.json")"

playwright_dir="$tmp/playwright"
mkdir -p "$playwright_dir"
: > "$npm_log"
ensure_playwright "$playwright_dir" >/dev/null
assert_eq 'playwright install' 1 "$(wc -l < "$npm_log" | tr -d ' ')"
mkdir -p "$playwright_dir/node_modules/@playwright/test"
: > "$playwright_dir/node_modules/@playwright/test/package.json"
: > "$npm_log"
ensure_playwright "$playwright_dir" >/dev/null
assert_eq 'playwright install skipped' 0 "$(wc -l < "$npm_log" | tr -d ' ')"

printf 'ci: shell tests passed\n'
