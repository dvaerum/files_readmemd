#!/bin/sh
# Dependency setup with explicit paths and a source hash as the cache key.

# Playwright's container only mounts ci/, so the browser specs cannot read the
# app-root declarations directly. Setup overwrites the tracked copies; the
# shell suite compares them byte-for-byte so a stale copy fails the gate.
sync_zone_declaration() {
	app_dir=$1
	ci_dir=$2
	[ -f "$app_dir/zones.json" ] || ci_fail "missing zone declaration: $app_dir/zones.json"
	cp "$app_dir/zones.json" "$ci_dir/zones.json"
}

sync_engine_declaration() {
	app_dir=$1
	ci_dir=$2
	[ -f "$app_dir/engines.json" ] || ci_fail "missing engine declaration: $app_dir/engines.json"
	cp "$app_dir/engines.json" "$ci_dir/engines.json"
}

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
