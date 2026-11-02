#!/bin/sh

set -eu

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
mode=${1:-}

if [ "$#" -gt 1 ]; then
  printf 'Usage: %s [local|network]\n' "$0" >&2
  exit 2
fi

if [ -z "$mode" ]; then
  printf 'how do you want to run sidequest:\n'
  printf '  1) local\n'
  printf '  2) network\n'
  printf 'enter 1 or 2: '
  read -r choice
  case "$choice" in
    1) mode=local ;;
    2) mode=network ;;
    *)
      printf 'invalid choice. enter 1 or 2.\n' >&2
      exit 2
      ;;
  esac
fi

case "$mode" in
  local) host=127.0.0.1 ;;
  network) host=0.0.0.0 ;;
  *)
    printf 'Usage: %s [local|network]\n' "$0" >&2
    exit 2
    ;;
esac

cd "$repo_root"

venv_python="$repo_root/.venv/bin/python"
if [ ! -x "$venv_python" ]; then
  if [ -x "$repo_root/.venv/Scripts/python.exe" ]; then
    venv_python="$repo_root/.venv/Scripts/python.exe"
  else
    if command -v python3 >/dev/null 2>&1; then
      python_command=python3
    elif command -v python >/dev/null 2>&1; then
      python_command=python
    else
      printf 'need python3 to run backend\n' >&2
      exit 1
    fi
    printf 'venv not found, creating\n'
    "$python_command" -m venv "$repo_root/.venv"
    venv_python="$repo_root/.venv/bin/python"
    if [ ! -x "$venv_python" ]; then
      venv_python="$repo_root/.venv/Scripts/python.exe"
    fi
  fi
fi

if ! "$venv_python" -c 'import fastapi, supabase, PIL, dotenv' >/dev/null 2>&1; then
  printf 'installing reqs\n'
  "$venv_python" -m pip install -r "$repo_root/packages/sidequest-backend/requirements.txt"
fi

venv_bin=$(dirname "$venv_python")
PATH="$venv_bin:$PATH"
export PATH

npm run dev -- --host "$host" &
backend_pid=$!
npm run dev --workspace=sidequest-frontend -- --host "$host" --port 5173 --strictPort &
frontend_pid=$!

cleanup() {
  trap - INT TERM EXIT
  kill "$backend_pid" "$frontend_pid" 2>/dev/null || true
  wait "$backend_pid" 2>/dev/null || true
  wait "$frontend_pid" 2>/dev/null || true
}

trap cleanup INT TERM EXIT

printf '\nbackend:  http://%s:8000\n' "$host"
printf 'frontend: http://%s:5173\n' "$host"
if [ "$mode" = network ]; then
  printf 'to connect others, replace 0.0.0.0 with this computer'\''s ip.\n'
  printf 'ctrl c to stop\n\n'
else
  printf 'ctrl c to stop.\n\n'
fi

while kill -0 "$backend_pid" 2>/dev/null &&
      kill -0 "$frontend_pid" 2>/dev/null; do
  sleep 1
done

exit_status=0
if ! kill -0 "$backend_pid" 2>/dev/null; then
  if wait "$backend_pid"; then
    backend_status=0
  else
    backend_status=$?
  fi
  printf 'backend stopped%s\n' "${backend_status:+ (exit $backend_status)}" >&2
  exit_status=$backend_status
fi

if ! kill -0 "$frontend_pid" 2>/dev/null; then
  if wait "$frontend_pid"; then
    frontend_status=0
  else
    frontend_status=$?
  fi
  printf 'frontend stopped%s\n' "${frontend_status:+ (exit $frontend_status)}" >&2
  if [ "$exit_status" -eq 0 ]; then
    exit_status=$frontend_status
  fi
fi

exit "$exit_status"