# Spike: pyright as the type checker for Source Python

Question: can we embed an existing checker (rather than writing one) to type-check annotated
Source Python §4 / Full Python in the browser? **Answer: yes.** `browser-basedpyright` (a browser
build of basedpyright, an MIT-licensed pyright fork) runs as a web worker with an in-memory file
system, and after trimming it costs ~0.8 MB over the wire.

## Run it

```sh
npm install
npm run build            # trimmed bundles + Source-flavoured builtins.pyi into build/
npm run cases            # corpus in cases/ under Node (worker_threads + a 10-line shim)
npm run cases:source     # same, with the Source builtins.pyi (strict bool, ** types)
npm run cases:typed      # same, plus the Typed Python §4 rules (no unknown types, annotated params)
npm run browser -- chromium|firefox|webkit   # corpus in a real browser via Playwright
```

## How it is wired

* The bundle is an LSP server over `postMessage`. Host protocol: post
  `{type: "browser/boot", mode: "foreground"}`, then LSP `initialize` with
  `initializationOptions.files = {path: text}` (merged over the embedded typeshed, so typeshed files
  can be overridden too). The server then asks the host for a background-analysis worker
  (`browser/newWorker` carrying a `MessagePort`); the host spawns the same script with
  `{type: "browser/boot", mode: "background", port, initialData}`. Diagnostics arrive as
  `textDocument/publishDiagnostics`. See `web/checker.js` (~70 lines).
* `prelude/__builtins__.pyi` declares the Source prelude. Pyright merges a project-root
  `__builtins__.pyi` into builtins, so students need no imports. Pairs are an opaque
  `Pair[H, T]`; `LList[T] = Pair[T, LList[T]] | None`; `Stream[T]` likewise. Predicates
  (`is_none`, `is_pair`, …) return `TypeIs[...]` so `0 if is_none(xs) else head(xs)` narrows.
  `TypeIs` needs `pythonVersion: 3.13`.
* SA modules: stubs at `typings/<module>/__init__.pyi` work (`show(5)` is reported against `Rune`).

## Results

Corpus: `cases/` — 4 clean SICP-style programs (recursion, HOFs, linked lists, streams,
`nonlocal` closures, Python lists, loops, pair mutation), 1 file with 14 planted errors,
1 unannotated file, 1 file of Source-only rules.

| | |
|---|---|
| false positives on clean programs (`standard` mode) | **0** |
| planted errors caught | **14 / 14** (+1 optional) |
| unannotated code | 3 / 6: only errors that need no parameter types (as expected) |
| Source strict-bool rules (with patched `builtins.pyi`) | 4 / 5 (`if 1`, ternary on str, `not 0`, `True + 1`); misses `3 and 4` |

`recommended`/`all` modes add noise for students ("partially unknown", unused call results);
`standard` is the right default.

Bundle sizes (`npm run build`):

| bundle | raw | gzip | brotli |
|---|---|---|---|
| as published | 18.0 MB | 3.2 MB | 2.4 MB |
| without third-party stubs (`stubs/`, 4654 files, 10.5 MB) | 7.5 MB | 1.5 MB | 1.1 MB |
| + only the 55 stdlib stubs `builtins`/`typing` import | 4.7 MB | 1.0 MB | **0.77 MB** |

Same corpus results for all three. Trimming stdlib also makes `import os` etc. unresolvable,
which suits Source.

Timings (minimal bundle):

| | Node 22 | Chromium 153 | Firefox 155 | WebKit 26.6 |
|---|---|---|---|---|
| worker startup (`initialize`) | 133 ms | 178 ms | 280 ms | 227 ms |
| first check (cold builtins) | 330 ms | 213 ms | 324 ms | 296 ms |
| further programs | 8–35 ms | 8–27 ms | 9–42 ms | 9–35 ms |
| re-check after edit (`didChange`) | | ~270 ms | ~290 ms | ~280 ms |

The ~270 ms re-check is the server's change debounce, not analysis time.

## Findings that matter for the real implementation

1. **py-slang cannot parse annotations on `def`.** `param` and `statementDef` in
   `src/parser/python.ne` have no `: T` / `-> T`, and `FunctionParam` has no field for them;
   `AnnAssign` parses but every chapter's validator rejects it. A typed variant needs grammar +
   AST fields (`RARROW` already exists in the tokenizer) and engines that ignore annotations.
2. **Strict bool is not a pyright rule**, but our own `builtins.pyi` gets most of it
   (`patch-builtins.cjs`): `__bool__ -> None` on int/float/complex/str/list/tuple/dict gives
   "Invalid conditional operand of type …" in if/while/ternary/`not` (and so does
   `NoneType.__bool__ -> None`, patched in `types.pyi`, for `if None:`); `bool` not subclassing `int`
   rejects `True + 1` and `xs[True]`, while `bool` keeps `<`/`<=`/`>`/`>=` with numbers, which
   Python §4 allows. The same script types `**` by Python §4's operator table instead of
   typeshed's `Any`. Only use this for Source chapters, not Full Python. The left operand of
   `and`/`or` would need a small extra check.
3. **Messages leak stub type variables** (`Pair[_H@head, Any]`): name the prelude's TypeVars
   for students (`H`, `T`, `A`) and/or post-process messages.
4. **Upstream risk:** browser-basedpyright is a side build of a one-maintainer fork, with a
   "works in the playground, no promises elsewhere" disclaimer. Mitigation: pin the version and
   vendor the trimmed bundle; it is self-contained (one file, no network, no
   `SharedArrayBuffer`/COOP-COEP requirement observed). Fallback: build our own browser bundle
   from upstream pyright the same way (microbit-foundation's fork was the original).
5. Unannotated code gets little from pyright, so the checker belongs to an annotated
   ("typed") variant of the chapters, not as a silent add-on to the existing ones.
