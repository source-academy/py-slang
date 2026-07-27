Piggybacks a WASM build of the C-based Pynter interpreter as an alternative PVML interpreter
pathway.

https://github.com/source-academy/pynter

`pynterwasm.js`/`pynterwasm.wasm` come from the `@sourceacademy/pynter-wasm` npm package (see
`package.json`) — a real, versioned build of Pynter's actual C source (not a vendored, manually-
copied snapshot; see pynter's own `devices/wasm/npm/` and `.github/workflows/publish-wasm-npm.yml`
for how it's built and published). Bumping the version is a normal, reviewable dependency bump, same
as any other npm dependency — not a manual rebuild-and-copy step. (An earlier vendored-artifact setup
here went stale for weeks and silently missed a VM-side `range()`/for-loop fix — see py-slang#268 —
which is exactly what motivated moving to a real published package.)

Its implementation may still carry some behavior tuned for Source/JS semantics rather than Python's
own, inherited from the Sinter fork and not yet audited here — treat a mismatch against this
dialect's Python semantics as worth checking against `pynter`'s own issue tracker rather than
assumed-correct.
