#!/usr/bin/env bash
set -euo pipefail

shopt -s nullglob

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
CLI_PATH="${BACKLOG_SMOKE_CLI:-${REPO_ROOT}/src/cli.ts}"
BUN_BIN="${BUN_BIN:-bun}"
JOB_COUNT="${JOB_COUNT:-8}"
KEEP_TEMP="${KEEP_TEMP:-0}"
TMP_ROOT=""

PIDS=()
LABELS=()
OUTFILES=()

usage() {
	cat <<EOF
Usage: $(basename "$0") [--jobs N] [--keep-temp]

Runs real parallel smoke tests against the local Backlog.md CLI:
  1. concurrent task creation
  2. concurrent draft promotion
  3. concurrent task demotion

Environment overrides:
  BUN_BIN            Bun executable to use (default: bun)
  BACKLOG_SMOKE_CLI  Path to local CLI entrypoint (default: <repo>/src/cli.ts)
  JOB_COUNT          Number of concurrent creates for scenario 1 (default: 8)
  KEEP_TEMP          Keep temp repos after success (default: 0)
EOF
}

info() {
	printf '[smoke] %s\n' "$*"
}

fail() {
	printf '[smoke] ERROR: %s\n' "$*" >&2
	if [[ -n "${TMP_ROOT}" && -d "${TMP_ROOT}" ]]; then
		printf '[smoke] Temp data preserved at: %s\n' "${TMP_ROOT}" >&2
	fi
	exit 1
}

cleanup() {
	local exit_code=$?
	if [[ $exit_code -eq 0 && "${KEEP_TEMP}" != "1" && -n "${TMP_ROOT}" && -d "${TMP_ROOT}" ]]; then
		rm -rf "${TMP_ROOT}"
		return
	fi

	if [[ -n "${TMP_ROOT}" && -d "${TMP_ROOT}" ]]; then
		info "Temp data kept at: ${TMP_ROOT}"
	fi
}
trap cleanup EXIT

run_cli() {
	"${BUN_BIN}" "${CLI_PATH}" "$@"
}

set_check_active_branches_false() {
	local config_path=$1
	if [[ -f "${config_path}" ]]; then
		perl -0pi -e 's/checkActiveBranches:\s*true/checkActiveBranches: false/g' "${config_path}"
	fi
}

init_repo() {
	local repo_dir=$1
	mkdir -p "${repo_dir}"
	pushd "${repo_dir}" >/dev/null
	git init -q
	git config user.name "Backlog Smoke Test"
	git config user.email "smoke@example.com"
	run_cli init "Parallel Lock Smoke" --defaults --integration-mode none --check-branches false --include-remote false >/dev/null
	set_check_active_branches_false "${repo_dir}/backlog/backlog.config.yml"
	popd >/dev/null
}

start_job() {
	local repo_dir=$1
	local label=$2
	shift 2

	local outfile="${repo_dir}/${label}.out"
	(
		cd "${repo_dir}"
		run_cli "$@"
	) >"${outfile}" 2>&1 &

	PIDS+=("$!")
	LABELS+=("${label}")
	OUTFILES+=("${outfile}")
}

reset_jobs() {
	PIDS=()
	LABELS=()
	OUTFILES=()
}

wait_for_jobs() {
	local i
	local failed=0
	local status=0

	for ((i = 0; i < ${#PIDS[@]}; i += 1)); do
		if ! wait "${PIDS[$i]}"; then
			status=$?
			printf '[smoke] Job failed: %s (exit %s)\n' "${LABELS[$i]}" "${status}" >&2
			printf '----- %s -----\n' "${OUTFILES[$i]}" >&2
			cat "${OUTFILES[$i]}" >&2 || true
			failed=1
		fi
	done

	if [[ ${failed} -ne 0 ]]; then
		fail "One or more parallel jobs failed."
	fi

	reset_jobs
}

assert_sequential_ids() {
	local target_dir=$1
	local prefix=$2
	local expected_count=$3

	local files=("${target_dir}"/*.md)
	local actual_count=${#files[@]}
	if [[ ${actual_count} -ne ${expected_count} ]]; then
		printf '[smoke] Expected %s files in %s but found %s\n' "${expected_count}" "${target_dir}" "${actual_count}" >&2
		ls -la "${target_dir}" >&2 || true
		fail "Unexpected file count in ${target_dir}"
	fi

	local ids=""
	local file
	local base
	local id
	for file in "${files[@]}"; do
		base="$(basename "${file}")"
		id="${base%% - *}"
		ids+="${id}"$'\n'
	done

	local unique_count
	unique_count="$(printf '%s' "${ids}" | sed '/^$/d' | sort -u | wc -l | tr -d ' ')"
	if [[ "${unique_count}" -ne "${expected_count}" ]]; then
		printf '[smoke] Duplicate IDs detected in %s:\n%s' "${target_dir}" "${ids}" >&2
		fail "Expected unique IDs in ${target_dir}"
	fi

	local n
	for n in $(seq 1 "${expected_count}"); do
		if ! printf '%s' "${ids}" | grep -qx "${prefix}-${n}"; then
			printf '[smoke] Missing expected ID %s-%s in %s:\n%s' "${prefix}" "${n}" "${target_dir}" "${ids}" >&2
			fail "Unexpected ID sequence in ${target_dir}"
		fi
	done
}

scenario_parallel_create() {
	local repo_dir="${TMP_ROOT}/create"
	local i

	info "Scenario 1: concurrent task creation (${JOB_COUNT} jobs)"
	init_repo "${repo_dir}"

	for i in $(seq 1 "${JOB_COUNT}"); do
		start_job "${repo_dir}" "create-${i}" task create "Parallel Task ${i}"
	done
	wait_for_jobs

	assert_sequential_ids "${repo_dir}/backlog/tasks" "task" "${JOB_COUNT}"
	info "Scenario 1 passed"
}

scenario_parallel_promote() {
	local repo_dir="${TMP_ROOT}/promote"

	info "Scenario 2: concurrent draft promotion"
	init_repo "${repo_dir}"

	pushd "${repo_dir}" >/dev/null
	run_cli draft create "Draft A" >/dev/null
	run_cli draft create "Draft B" >/dev/null
	popd >/dev/null

	start_job "${repo_dir}" "promote-a" draft promote draft-1
	start_job "${repo_dir}" "promote-b" draft promote draft-2
	wait_for_jobs

	assert_sequential_ids "${repo_dir}/backlog/tasks" "task" 2

	local remaining_drafts=("${repo_dir}/backlog/drafts"/*.md)
	if [[ ${#remaining_drafts[@]} -ne 0 ]]; then
		ls -la "${repo_dir}/backlog/drafts" >&2 || true
		fail "Expected no remaining drafts after promotion"
	fi

	info "Scenario 2 passed"
}

scenario_parallel_demote() {
	local repo_dir="${TMP_ROOT}/demote"

	info "Scenario 3: concurrent task demotion"
	init_repo "${repo_dir}"

	pushd "${repo_dir}" >/dev/null
	run_cli task create "Task A" >/dev/null
	run_cli task create "Task B" >/dev/null
	popd >/dev/null

	start_job "${repo_dir}" "demote-a" task demote task-1
	start_job "${repo_dir}" "demote-b" task demote task-2
	wait_for_jobs

	assert_sequential_ids "${repo_dir}/backlog/drafts" "draft" 2

	local remaining_tasks=("${repo_dir}/backlog/tasks"/*.md)
	if [[ ${#remaining_tasks[@]} -ne 0 ]]; then
		ls -la "${repo_dir}/backlog/tasks" >&2 || true
		fail "Expected no remaining tasks after demotion"
	fi

	info "Scenario 3 passed"
}

main() {
	while [[ $# -gt 0 ]]; do
		case "$1" in
			--jobs)
				JOB_COUNT=$2
				shift 2
				;;
			--keep-temp)
				KEEP_TEMP=1
				shift
				;;
			-h|--help)
				usage
				exit 0
				;;
			*)
				usage >&2
				fail "Unknown argument: $1"
				;;
		esac
	done

	if ! command -v "${BUN_BIN}" >/dev/null 2>&1; then
		fail "Bun executable not found: ${BUN_BIN}"
	fi

	if [[ ! -f "${CLI_PATH}" ]]; then
		fail "Local CLI entrypoint not found: ${CLI_PATH}"
	fi

	case "${JOB_COUNT}" in
		''|*[!0-9]*)
			fail "JOB_COUNT must be a positive integer"
			;;
	esac

	if [[ "${JOB_COUNT}" -lt 2 ]]; then
		fail "JOB_COUNT must be at least 2"
	fi

	TMP_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/backlog-lock-smoke.XXXXXX")"
	info "Using temp root: ${TMP_ROOT}"

	scenario_parallel_create
	scenario_parallel_promote
	scenario_parallel_demote

	info "All parallel locking smoke tests passed"
}

main "$@"
