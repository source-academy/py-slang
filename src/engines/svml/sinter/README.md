Piggybacks the C-based SVML interpreter as alternative SVML interpreter pathway

https://github.com/source-academy/sinter

However, note that its implementation is tuned for Javascript semantics.

Therefore, Python code like

```python
a = 3
b = 5

print(min(a,b)) # works like Python, returns 3
print(min(a))   # Javascript quirk, returns False instead of reporting error
```
