#!/bin/sh
# One parser for the app's declared Nextcloud support range. The boot hook,
# browser CI and the divergence test all read appinfo/info.xml through here.

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
