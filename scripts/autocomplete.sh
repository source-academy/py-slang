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
for file in "$LIB"/*.js; do
  echo "Processing $file..."
  $JSDOC -X -c "$CONF" "$file" > "src/conductor/plugins/autocomplete/builtins/$(basename "$file" .js).json" &
done
wait

yarn ts-node src/generate-autocomplete.mts
