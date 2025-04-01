#! /usr/bin/env bash

set -e

JSDOC="script/jsdoc"
TMPL="docs/jsdoc/templates/template"
DST="docs/python"
MD="docs/md"
LIB="docs/lib"
SPECS="docs/python/specs"

main() {

    if [ "$1" == "prepare" ]; then
	prepare
    elif [ "$1" == "clean" ]; then
	clean
    elif [[ "$(git rev-parse --show-toplevel 2> /dev/null)" -ef "$PWD" ]]; then
        run
    else
        echo "Please run this command from the git root directory."
        false  # exit 1
    fi
}

run() {

    # Source §1
    
    ${JSDOC} -r -t ${TMPL} \
	     -c docs/jsdoc/conf.json \
	     -R ${MD}/README_1.md \
	     -d ${DST}/"source_1"/ \
	     ${LIB}/misc.js \
	     ${LIB}/math.js

    # MISC
    
    ${JSDOC} -r -t ${TMPL} \
	     -c docs/jsdoc/conf.json \
	     -R ${MD}/README_MISC.md \
	     -d ${DST}/MISC/ \
	     ${LIB}/misc.js
    
    # MATH
    
    ${JSDOC} -r -t ${TMPL} \
	     -c docs/jsdoc/conf.json \
	     -R ${MD}/README_MATH.md \
	     -d ${DST}/MATH/ \
	     ${LIB}/math.js
}

prepare() {
    run
    cp -r docs/images ${DST} ; \
    cd ${SPECS}; make; cp *.pdf ../source; cd ../..
}

clean() {

    rm -rf  ${DST}/*
    
}

main $1
