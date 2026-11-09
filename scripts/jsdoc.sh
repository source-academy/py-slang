#! /usr/bin/env bash

# Exit immediately if a command exits with a non-zero status.
set -e

JSDOC="$(yarn bin jsdoc)"
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
  # a path of its own, if it is absolute (a generated page); else a file of docs/md
  local readme_path="$MD/$readme"
  if [[ "$readme" == /* ]]; then readme_path="$readme"; fi
  local dst_subfolder=$3
  shift 3
  local libs=$@

  echo "Building $name..."
  $JSDOC -r -t "$TMPL" \
         -c docs/jsdoc/conf.json \
         -R "$readme_path" \
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

  # LINKED LIST
  run_jsdoc "LINKED LIST" "README_LINKED LIST.md" "LINKED LIST" "$LIB/linked_list.js" &

  # PAIR MUTATOR
  run_jsdoc "PAIR MUTATOR" "README_PAIR MUTATOR.md" "PAIR MUTATOR" "$LIB/pairmutator.js" &

  # LIST
  run_jsdoc "LIST" "README_LIST.md" "LIST" "$LIB/list.js" &

  # STREAM
  run_jsdoc "STREAM" "README_STREAM.md" "STREAM" "$LIB/stream.js" &

  # MCE
  run_jsdoc "MCE" "README_MCE.md" "MCE" "$LIB/mce.js" &
  

  # Environment stepper: a guide for students (a page of its own, no library functions)
  run_jsdoc "Environment stepper" "README_ESTEPPER.md" "e-stepper" "$LIB/empty.js" &

  # Python §1
  run_jsdoc "Python §1" "README_1.md" "python_1" "$LIB/misc.js" "$LIB/math.js" &
  
  # Python §2
  run_jsdoc "Python §2" "README_2.md" "python_2" "$LIB/misc.js" "$LIB/math.js" "$LIB/linked_list.js" &

  # Python §3
  run_jsdoc "Python §3" "README_3.md" "python_3" "$LIB/misc.js" "$LIB/math.js" "$LIB/linked_list.js" "$LIB/pairmutator.js" "$LIB/list.js" "$LIB/stream.js" &

  # Python §4
  run_jsdoc "Python §4" "README_4.md" "python_4" "$LIB/misc.js" "$LIB/math.js" "$LIB/linked_list.js" "$LIB/pairmutator.js" "$LIB/list.js" "$LIB/stream.js" "$LIB/mce.js" &

  # Python §4 Typed: the documentation of the predeclared names with their types, which come from the
  # declarations that the type checker uses (src/typecheck/prelude.pyi): the library sources with the types
  # (scripts/typed-lib.ts), and a front page with the types of all names (scripts/typed-readme.ts)
  local typed_dir typed_readme typed_lib
  typed_dir="$(mktemp -d)"
  typed_readme="$typed_dir/README_4_typed.md"
  typed_lib="$typed_dir/lib"
  yarn tsx scripts/typed-lib.ts "$typed_lib"
  yarn tsx scripts/typed-readme.ts "$MD/README_4_typed.md" src/typecheck/prelude.pyi "$typed_readme"
  run_jsdoc "Python §4 Typed" "$typed_readme" "python_4_typed" "$typed_lib/misc.js" "$typed_lib/math.js" "$typed_lib/linked_list.js" "$typed_lib/pairmutator.js" "$typed_lib/list.js" "$typed_lib/stream.js" "$typed_lib/mce.js" &
  run_jsdoc "MISC (typed)" "README_MISC.md" "MISC_typed" "$typed_lib/misc.js" &
  run_jsdoc "MATH (typed)" "README_MATH.md" "MATH_typed" "$typed_lib/math.js" &
  run_jsdoc "LINKED LIST (typed)" "README_LINKED LIST.md" "LINKED LIST_typed" "$typed_lib/linked_list.js" &
  run_jsdoc "PAIR MUTATOR (typed)" "README_PAIR MUTATOR.md" "PAIR MUTATOR_typed" "$typed_lib/pairmutator.js" &
  run_jsdoc "LIST (typed)" "README_LIST.md" "LIST_typed" "$typed_lib/list.js" &
  run_jsdoc "STREAM (typed)" "README_STREAM.md" "STREAM_typed" "$typed_lib/stream.js" &
  run_jsdoc "MCE (typed)" "README_MCE.md" "MCE_typed" "$typed_lib/mce.js" &

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
