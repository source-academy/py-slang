#! /usr/bin/env bash

# Exit immediately if a command exits with a non-zero status.
set -e

JSDOC="node_modules/.bin/jsdoc"
TMPL="docs/jsdoc/templates/template"
DST="docs/python"
MD="docs/md"
LIB="docs/lib"
SPECS="docs/specs"

# check if command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}


# check that the commands are being run from the root of the git repository
check_git_root() {
  if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "Error: Not a git repository."
    exit 1
  fi
  
  GIT_ROOT=$(git rev-parse --show-toplevel)
  if [ "$PWD" != "$GIT_ROOT" ]; then
    echo "Please run this command from the git root directory"
    exit 1
  fi
}

# for future additions of chapters in run()
# Usage: run_jsdoc <name> <readme> <dst_subfolder> <libs...>
run_jsdoc() {
  local name=$1
  local readme=$2
  local dst_subfolder=$3
  shift 3
  local libs=$@

  echo "Building $name..."
  $JSDOC -r -t "$TMPL" \
         -c docs/jsdoc/conf.json \
         -R "$MD/$readme" \
         -d "$DST/$dst_subfolder" \
         $libs
  echo "Finished $name."
}

run() {
  mkdir -p "$DST"
  # landing page                                                                                                                                                                                            
  run_jsdoc "Landing Page" "README_top.md" "" "$LIB/empty.js" 

  # MISC
  run_jsdoc "MISC" "README_MISC.md" "MISC" "$LIB/misc.js" &

  # MATH
  run_jsdoc "MATH" "README_MATH.md" "MATH" "$LIB/math.js" &

  # LINKED LISTS
  run_jsdoc "LINKED LISTS" "README_LINKED LISTS.md" "LINKED LISTS" "$LIB/linked_list.js" &

  # Python §1
  run_jsdoc "Python §1" "README_1.md" "python_1" "$LIB/misc.js" "$LIB/math.js" &
  
  # Python §2
  run_jsdoc "Python §2" "README_2.md" "python_2" "$LIB/misc.js" "$LIB/math.js" "$LIB/linked_list.js" &

  wait
}

prepare() {
  run
  if [ -d "docs/images" ]; then
    echo "Copying images..."
    cp -r docs/images "$DST/"
  fi

  if [ -d "$SPECS" ]; then
    echo "Compiling specifications..."
    (
      cd "$SPECS"
      if command_exists make; then
        make
        cp *.pdf ../python/
        echo "Specifications compiled and copied."
      else
        echo "Warning: 'make' not found. Skipping LaTeX compilation."
      fi
    )
  else
    echo "Warning: Specs directory not found at $SPECS"
  fi
}

clean() {
  echo "Cleaning build artifacts in $DST..."
  rm -rf "$DST"
  echo "Cleaned $DST's built artifacts"
}

main() {
  check_git_root

  case "$1" in
    run)
      run
      ;;
    prepare)
      prepare
      ;;
    clean)
      clean
      ;;
    *)
      run
      ;;
  esac
}

main "$@"
