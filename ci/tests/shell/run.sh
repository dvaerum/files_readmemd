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

boot_hook=$(cat "$CI_DIR/hooks/before-starting/10-enable-files-readmemd.sh")
assert_has 'support-range.sh' "$boot_hook" 'boot hook sources the support parser'
assert_has 'support_allows' "$boot_hook" 'boot hook asks the parser about enablement'
assert_not_has '-gt 29' "$boot_hook" 'boot hook has no hard-coded version threshold'

ci_run=$(cat "$CI_DIR/run.sh")
assert_has 'support-range.sh' "$ci_run" 'CI runner sources the support parser'
assert_has 'support_allows' "$ci_run" 'CI runner derives compatibility expectations'

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
