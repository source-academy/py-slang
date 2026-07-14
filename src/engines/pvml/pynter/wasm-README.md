Piggybacks a WASM build of the C-based Pynter interpreter as an alternative PVML interpreter
pathway.

https://github.com/source-academy/pynter

`pynterwasm.js`/`pynterwasm.wasm` come from the `@sourceacademy/pynter-wasm` npm package (see
`package.json`) — a real, versioned build of Pynter's actual C source (not a vendored, manually-
copied snapshot; see pynter's own `devices/wasm/npm/` and `.github/workflows/publish-wasm-npm.yml`
for how it's built and published). Bumping the version is a normal, reviewable dependency bump, same
as any other npm dependency — not a manual rebuild-and-copy step.

However, note that its implementation is tuned for Javascript semantics.

Therefore, Python code like

```python
a = 3
b = 5

print(min(a,b)) # works like Python, returns 3
print(min(a))   # Javascript quirk, returns False instead of reporting error
```
