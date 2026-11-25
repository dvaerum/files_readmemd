#!/bin/sh
# One executable module for the Nextcloud Support range decision. The boot hook
# calls `enable`; the browser CI calls `expectation`. Both read appinfo/info.xml
# through the same parser, so no caller repeats a version threshold. The parser
# functions stay exported because older hook worktrees still source them.

# Prints "<min> <max>" from a Nextcloud app info.xml. The two attributes can
# appear in either order; a missing or malformed element prints nothing.
support_range() {
	info_xml=${1:-}
	[ -n "$info_xml" ] && [ -f "$info_xml" ] || return 0
	awk '
		function number(s, name,    pattern, value) {
			pattern = name "=\"[0-9][0-9]*\""
			if (!match(s, pattern)) return ""
			value = substr(s, RSTART, RLENGTH)
			gsub(/[^0-9]/, "", value)
			return value
		}
		/<nextcloud/ {
			min = number($0, "min-version")
			max = number($0, "max-version")
			if (min != "" && max != "") {
				print min, max
				exit
			}
		}
	' "$info_xml"
}

support_range_min() {
	set -- $(support_range "$1")
	printf '%s\n' "${1:-}"
}

support_range_max() {
	set -- $(support_range "$1")
	printf '%s\n' "${2:-}"
}

# True when a numeric major version is inside the declared range.
support_allows() {
	major=$1
	info_xml=$2
	set -- $(support_range "$info_xml")
	[ -n "${1:-}" ] && [ -n "${2:-}" ] || return 1
	[ "$major" -ge "$1" ] && [ "$major" -le "$2" ]
}

# 35-apache -> 35; also accepts a bare major version.
support_version_major() {
	printf '%s\n' "$1" | sed -n 's/^\([0-9][0-9]*\).*/\1/p'
}

# Internal seam shared by both executable commands.
support_expectation_for_major() {
	major=$1
	info_xml=$2
	if support_allows "$major" "$info_xml"; then
		printf 'enabled\n'
	else
		printf 'disabled\n'
	fi
}

# Read the running Nextcloud major through the occ adapter.
support_occ_major() {
	$1 status --output=json | sed -n 's/.*"version":"\([0-9][0-9]*\).*/\1/p'
}

support_enable() {
	app_id=$1
	info_xml=$2
	occ_command=$3
	[ -n "$app_id" ] && [ -n "$info_xml" ] && [ -n "$occ_command" ] || {
		echo 'usage: support-range.sh enable --app <id> --info <path> --occ <command>' >&2
		return 2
	}

	major=$(support_occ_major "$occ_command")
	[ -n "$major" ] || { echo "Could not read Nextcloud version" >&2; return 1; }

	if [ "$(support_expectation_for_major "$major" "$info_xml")" = enabled ]; then
		$occ_command app:enable "$app_id"
	else
		echo "Skipping $app_id: supports Nextcloud $(support_range_min "$info_xml")-$(support_range_max "$info_xml"), this is NC $major"
	fi
}

support_expectation() {
	info_xml=$1
	version=$2
	[ -n "$info_xml" ] && [ -n "$version" ] || {
		echo 'usage: support-range.sh expectation --info <path> --version <tag>' >&2
		return 2
	}
	major=$(support_version_major "$version")
	[ -n "$major" ] || { echo "Could not read a major version from $version" >&2; return 1; }
	support_expectation_for_major "$major" "$info_xml"
}

support_range_usage() {
	echo 'usage: support-range.sh enable --app <id> --info <path> --occ <command>' >&2
	echo '       support-range.sh expectation --info <path> --version <tag>' >&2
}

support_range_main() {
	command=${1:-}
	[ $# -eq 0 ] || shift

	case "$command" in
		enable)
			app_id=''
			info_xml=''
			occ_command=''
			while [ $# -gt 0 ]; do
				case "$1" in
					--app) app_id=${2:-}; shift 2 || return 2 ;;
					--info) info_xml=${2:-}; shift 2 || return 2 ;;
					--occ) occ_command=${2:-}; shift 2 || return 2 ;;
					*) echo "unknown option '$1'" >&2; return 2 ;;
				esac
			done
			support_enable "$app_id" "$info_xml" "$occ_command"
			;;
		expectation)
			info_xml=''
			version=''
			while [ $# -gt 0 ]; do
				case "$1" in
					--info) info_xml=${2:-}; shift 2 || return 2 ;;
					--version) version=${2:-}; shift 2 || return 2 ;;
					*) echo "unknown option '$1'" >&2; return 2 ;;
				esac
			done
			support_expectation "$info_xml" "$version"
			;;
		*)
			support_range_usage
			return 2
			;;
	esac
}

# Sourcing must stay side-effect free: config.sh and the boot hook's older
# worktree call the parser functions above directly.
if [ "${0##*/}" = 'support-range.sh' ]; then
	support_range_main "$@"
fi
