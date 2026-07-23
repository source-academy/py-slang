Piggybacks a WASM build of the C-based Pynter interpreter as an alternative PVML interpreter
pathway.

https://github.com/source-academy/pynter

`pynterwasm.js`/`pynterwasm.wasm`/`pynterwasm.d.ts` are vendored, precompiled artifacts, built from
the `devices/wasm/wasm` CMake target in the `pynter` repo (not from Sinter — that was true early on
when Pynter was still an unmodified Sinter fork, no longer accurate now that Pynter has its own
Python-specific VM changes: `range()`/for-loops, floor division, complex numbers, etc. — see that
repo's own README). Rebuild whenever pynter's VM changes need to reach this pathway (nothing does so
automatically — a stale vendored binary silently missing a VM-side fix is exactly what caused
py-slang#268):

```sh
# from the pynter repo
mkdir -p devices/wasm/build && cd devices/wasm/build
emcmake cmake ../wasm
make -j4
# then copy pynterwasm.js/.wasm/.d.ts into py-slang's src/engines/pvml/pynter/,
# run `npx prettier --write` on the .js/.d.ts (emscripten's own formatting doesn't
# match this repo's), and add back the `/* eslint-disable */` line each starts with.
```

Its implementation may still carry some behavior tuned for Source/JS semantics rather than Python's
own, inherited from the Sinter fork and not yet audited here — treat a mismatch against this
dialect's Python semantics as worth checking against `pynter`'s own issue tracker rather than
assumed-correct.
