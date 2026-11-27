#!/bin/sh
# Single configuration seam for the browser CI. ci_config prints shell-safe
# export assignments; callers eval them once and pass values explicitly.

_ci_dir=${CI_DIR:-$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)}
. "$_ci_dir/lib/support-range.sh"

ci_fail() { printf 'ci: %s\n' "$*" >&2; exit 1; }

ci_quote() {
	printf "'%s'" "$(printf '%s' "$1" | sed "s/'/'\\\\''/g")"
}

ci_emit() { printf 'export %s=%s\n' "$1" "$(ci_quote "$2")"; }

# Hash source and build inputs, not the generated js directory: stale assets
# must not pass the freshness check after a source edit.
ci_build_stamp() {
	app_dir=$1
	[ -d "$app_dir/src" ] || ci_fail "missing source directory: $app_dir/src"
	(
		cd "$app_dir"
		{
			find src -type f -print
			for file in package.json package-lock.json webpack.js zones.json engines.json; do
				[ -f "$file" ] && printf '%s\n' "$file"
			done
		} | LC_ALL=C sort -u | xargs sha256sum
	) | sha256sum | awk '{ print $1 }'
}

ci_config() {
	profile=$1
	requested_version=${2:-}
	ci_dir=${CI_DIR:-}
	[ -n "$ci_dir" ] || ci_fail 'CI_DIR must be set before calling ci_config'
	app_dir=$(dirname "$ci_dir")

	support_info="$app_dir/appinfo/info.xml"
	support_min=$(support_range_min "$support_info")
	support_max=$(support_range_max "$support_info")
	[ -n "$support_min" ] && [ -n "$support_max" ] ||
		ci_fail "could not read support range from $support_info"

	main_project=${CI_PROJECT:-files_readmemd-ci}
	negative_project=${CI_NEGATIVE_PROJECT:-files_readmemd-ci-negative}
	main_port=${NEXTCLOUD_HOST_PORT:-8290}
	negative_port=${CI_NEGATIVE_PORT:-8291}
	base_sha=${BASE_SHA:-c31d8a243678b4f04348c40fca1e5a8e587a05aa}
	compat_versions=${COMPAT_VERSIONS:-'33-apache 34-apache 35-apache'}
	states='default features engines-on filelist-extra'

	case "$profile" in
		setup|full|compat|negative|all|down|shell-test) ;;
		*) ci_fail "unknown CI profile '$profile'" ;;
	esac

	case "$profile" in
		negative)
			project=$negative_project
			port=$negative_port
			version=${requested_version:-${NEGATIVE_VERSION:-35-apache}}
			image=${NEGATIVE_IMAGE:-nextcloud:$version}
			projects=$negative_project
			;;
		compat)
			project=$main_project
			port=$main_port
			version=${requested_version:-${compat_versions%% *}}
			image=${COMPAT_IMAGE:-nextcloud:$version}
			projects=$main_project
			;;
		full|all|setup)
			project=$main_project
			port=$main_port
			version=${requested_version:-${FULL_VERSION:-${NEXTCLOUD_VERSION:-29-apache}}}
			image=${FULL_IMAGE:-${NEXTCLOUD_IMAGE:-nextcloud:$version}}
			projects=$main_project
			[ "$profile" = all ] && projects="$main_project $negative_project"
			;;
		down)
			project=$main_project
			port=$main_port
			version=''
			image=''
			projects="$main_project $negative_project"
			;;
		shell-test)
			project=$main_project
			port=$main_port
			version=''
			image=''
			projects=''
			;;
	esac

	ci_emit PROFILE "$profile"
	ci_emit PROJECT "$project"
	# Compose interpolates these two names, not the function's local aliases.
	ci_emit CI_PROJECT "$project"
	ci_emit NEXTCLOUD_HOST_PORT "$port"
	ci_emit PROJECTS "$projects"
	ci_emit NEGATIVE_PROJECT "$negative_project"
	ci_emit HOST_PORT "$port"
	ci_emit NEGATIVE_PORT "$negative_port"
	ci_emit NEXTCLOUD_VERSION "$version"
	ci_emit NEXTCLOUD_IMAGE "$image"
	ci_emit COMPAT_VERSIONS "$compat_versions"
	ci_emit STATE_LIST "$states"
	ci_emit KEEP_STACK "${KEEP_STACK:-0}"
	ci_emit UPDATE_BASELINES "${UPDATE_BASELINES:-0}"
	ci_emit BASE_SHA "$base_sha"
	ci_emit SUPPORT_MIN "$support_min"
	ci_emit SUPPORT_MAX "$support_max"
	stamp=$(ci_build_stamp "$app_dir")
	ci_emit BUILD_STAMP "$stamp"
	ci_emit CI_UID "$(id -u)"
	ci_emit CI_GID "$(id -g)"
	ci_emit NC_ADMIN_USER "${NC_ADMIN_USER:-admin}"
	ci_emit NC_ADMIN_PASSWORD "${NC_ADMIN_PASSWORD:-admin-password-please-change-me}"
}
