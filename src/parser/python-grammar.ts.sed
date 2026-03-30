/^declare var/d
s/(pythonLexer.has("\([^"]*\)") ? {type: "\1"} : \1)/{type: "\1"}/g
s/^\(type NearleySymbol =\)/\1 { type: any }|/
s/function arrpush(d) {/function arrpush<T>(d: [T[], T]) {/g
s/function\s*(d)\s*{\s*return null;\s*}/() => null/g
s/function id(x) {/function id(x: unknown[]) {/g
