#! /usr/bin/env bash

# Exit immediately if a command exits with a non-zero status.
set -e

JSDOC="$(yarn bin jsdoc)"
LIB="docs/lib"
CONF="docs/jsdoc/conf.json"

# Create the builtins directory if it doesn't exist
mkdir -p "src/conductor/plugins/autocomplete/builtins"

# Process every JavaScript file in the docs/lib directory with JSDoc,
# outputting the AST as JSON to the src/conductor/plugins/autocomplete/builtins directory.
# set -e doesn't apply inside background jobs, and a bare `wait` ignores their exit codes, so
# track each PID and check it explicitly. Writing to a .tmp file first (instead of truncating
# the final target via `>` before jsdoc even runs) means a failed run never leaves a truncated
# JSON file behind for generate-autocomplete.mts to trip over.
pids=()
for file in "$LIB"/*.js; do
  echo "Processing $file..."
  out="src/conductor/plugins/autocomplete/builtins/$(basename "$file" .js).json"
  ( "$JSDOC" -X -c "$CONF" "$file" > "$out.tmp" && mv "$out.tmp" "$out" ) &
  pids+=("$!")
done
for pid in "${pids[@]}"; do
  wait "$pid" || { echo "jsdoc failed" >&2; exit 1; }
done

yarn tsx src/generate-autocomplete.mts
