Piggybacks a WASM build of the C-based Pynter interpreter as an alternative PVML interpreter
pathway.

https://github.com/source-academy/pynter

`pynterwasm.js`/`pynterwasm.wasm` are vendored, precompiled artifacts — currently still built from
Sinter's real source (Pynter is presently an unmodified fork), not from a Pynter-specific rebuild.

However, note that its implementation is tuned for Javascript semantics.

Therefore, Python code like

```python
a = 3
b = 5

print(min(a,b)) # works like Python, returns 3
print(min(a))   # Javascript quirk, returns False instead of reporting error
```
