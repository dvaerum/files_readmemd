#!/bin/sh
# Container lifecycle and the two commands that cross the container boundary.
# Every function takes explicit arguments; none read profile state from globals.

ci_compose() {
	compose_file=$1
	project=$2
	shift 2
	# Volume names interpolate ${CI_PROJECT}; bind it to the project being
	# operated on so cleanup cannot touch another profile's volumes.
	CI_PROJECT="$project" docker compose -f "$compose_file" -p "$project" "$@"
}

# Prints one status line per project. Read-only, so it is safe in a fresh shell.
stack_status() {
	compose_file=$1
	project=$2
	ps_output=$(ci_compose "$compose_file" "$project" ps -q)
	count=$(printf '%s\n' "$ps_output" | awk 'NF { n++ } END { print n + 0 }')
	if [ "$count" -gt 0 ]; then
		printf '%s running (%s containers)\n' "$project" "$count"
	else
		printf '%s stopped\n' "$project"
	fi
}

stack_down() {
	compose_file=$1
	project=$2
	ci_compose "$compose_file" "$project" down -v --remove-orphans >/dev/null
	# Compose only removes volumes for the version it was last given. Drop any
	# other version-scoped volumes for this project, but never another project's.
	volumes=$(docker volume ls --format '{{.Name}}' |
		awk -v prefix="${project}_" 'index($0, prefix) == 1 { print }')
	for volume in $volumes; do
		if ! docker volume rm "$volume" >/dev/null; then
			printf 'ci: could not remove volume %s\n' "$volume" >&2
		fi
	done
	printf 'ci: stopped %s\n' "$project"
}

occ() {
	compose_file=$1
	project=$2
	shift 2
	ci_compose "$compose_file" "$project" exec -T -u www-data app php /var/www/html/occ "$@"
}

pw_run() {
	compose_file=$1
	project=$2
	update_baselines=$3
	shift 3
	ci_compose "$compose_file" "$project" run --rm \
		-e "UPDATE_BASELINES=$update_baselines" \
		-e "CI_APP_EXPECTED=${CI_APP_EXPECTED:-}" playwright "$@"
}

wait_for_pg() {
	compose_file=$1
	project=$2
	i=0
	# Readiness probes: failure is expected until the service answers.
	until ci_compose "$compose_file" "$project" exec -T db \
		pg_isready -U nextcloud >/dev/null 2>&1; do
		i=$((i + 1)); [ "$i" -gt 30 ] && ci_fail 'database did not become ready'
		sleep 2
	done
	# Without this the image's PostgreSQL setup can switch to an oc_adminN role,
	# which breaks later installs when tables from an earlier run still exist.
	i=0
	until ci_compose "$compose_file" "$project" exec -T db psql -U nextcloud -d nextcloud \
		-c 'ALTER ROLE nextcloud NOCREATEROLE' >/dev/null 2>&1; do
		i=$((i + 1)); [ "$i" -gt 30 ] && ci_fail 'could not fix database role privileges'
		sleep 2
	done
}

wait_for_nc() {
	port=$1
	i=0
	while [ "$i" -lt 120 ]; do
		if curl -fsS "http://localhost:${port}/status.php" >/dev/null 2>&1; then
			return 0
		fi
		i=$((i + 1))
		sleep 2
	done
	ci_fail "Nextcloud did not become ready on port $port"
}

stack_up() {
	compose_file=$1
	project=$2
	port=$3
	version=$4
	image=$5
	app_source=$6
	(
		export NEXTCLOUD_HOST_PORT="$port" NEXTCLOUD_VERSION="$version"
		export NEXTCLOUD_IMAGE="$image" APP_SOURCE="$app_source"
		echo "ci: starting $version on port $port"
		ci_compose "$compose_file" "$project" down -v --remove-orphans >/dev/null
		ci_compose "$compose_file" "$project" up -d db
		wait_for_pg "$compose_file" "$project"
		ci_compose "$compose_file" "$project" up -d app
		wait_for_nc "$port"
	)
}
