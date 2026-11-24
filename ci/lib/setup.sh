#!/bin/sh
# Dependency setup with explicit paths and a source hash as the cache key.

ensure_playwright() {
	ci_dir=$1
	if [ ! -f "$ci_dir/node_modules/@playwright/test/package.json" ]; then
		echo 'ci: installing Playwright package'
		(cd "$ci_dir" && npm ci)
	fi
}

assets_present() {
	app_dir=$1
	set -- "$app_dir"/js/files_readmemd-*.js
	[ -f "$1" ]
}

ensure_assets() {
	app_dir=$1
	stamp_file=$2
	stamp=$3
	stored=''
	if [ -f "$stamp_file" ]; then
		stored=$(cat "$stamp_file")
	fi
	if [ "$stored" = "$stamp" ] && assets_present "$app_dir"; then
		echo 'ci: app assets up to date'
		return 0
	fi
	echo 'ci: building app assets'
	(cd "$app_dir" && npm ci && npm run build)
	printf '%s\n' "$stamp" > "$stamp_file"
}
