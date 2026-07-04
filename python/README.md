# sourceacademy-sicp

The **Source Academy Python** standard library, packaged for plain **CPython**.

Source Academy runs a subset of Python (via
[`py-slang`](https://github.com/source-academy/py-slang)) that adds a standard
library for the *Structure and Interpretation of Computer Programs* (SICP) —
`pair`, `head`, `tail`, `llist`, the `math_*` functions, streams, and so on.
This package provides those same names to ordinary CPython, so that code written
for CS1101S or the SICP Python edition runs the same way on your own machine.

## Install

```bash
pip install sourceacademy-sicp
```

## Use

Put this at the top of your program:

```python
from sicp import *
```

Then the Source Academy Python standard library is available:

```python
xs = llist(1, 2, 3)
print(xs)                       # [1, [2, [3, None]]]
print_llist(xs)                 # llist(1, 2, 3)
print(list_length(build_list(lambda i: i * i, 5)))   # 5
print(math_sqrt(2))             # 1.4142135623730951
print(eval_stream(integers_from(1), 4))              # [1, [2, [3, [4, None]]]]
```

### Representation

A **pair** is a two-element Python list `[head, tail]`, and the **empty list**
is `None` — exactly as in Source Academy Python. A two-element list is therefore
also a pair (`is_pair` and `is_list` are both true), matching the frontend's
value model, so results print and compare directly against the textbook:

```python
pair("x", 9)      # ['x', 9]
llist(1, 2, 3)    # [1, [2, [3, None]]]
```

## What's included

The library mirrors the groups in `py-slang`'s standard library:

| submodule            | provides |
| -------------------- | -------- |
| `sicp.misc`          | `error`, `arity`, `real`, `imag`, `is_none` / `is_integer` / `is_float` / `is_complex` / `is_string` / `is_boolean` / `is_function` / `is_number`, `random_random`, `time_time` |
| `sicp.math`          | `math_pi`, `math_e`, `math_tau`, `math_inf`, `math_nan`, and the `math_*` functions (`math_sqrt`, `math_sin`, `math_floor`, `math_comb`, …) |
| `sicp.linked_list`   | `pair`, `head`, `tail`, `is_pair`, `llist`, `print_llist`, plus `map`, `filter`, `reduce`, `reverse`, `append`, `length`, `member`, `remove`, `enum_llist`, … |
| `sicp.pair_mutators` | `set_head`, `set_tail` |
| `sicp.list`          | `is_list`, `list_length`, `equal`, `build_list` |
| `sicp.stream`        | `stream`, `stream_map`, `stream_filter`, `stream_ref`, `integers_from`, `eval_stream`, … |

`from sicp import *` brings the whole superset into scope, mirroring the
environment students have in Source Academy's Python.

## Compatibility

- Requires Python 3.10+.
- `is_number` mirrors Scheme's `number?` primitive as used in the textbook.

## Source & development

This package lives in the [`py-slang`](https://github.com/source-academy/py-slang)
repository under `python/`. `py-slang` is the reference implementation of Source
Academy Python, so keeping the library here — next to the standard library it
mirrors (`src/stdlib/`) — is what keeps the two from drifting apart. Each
`sicp.<group>` submodule corresponds to a `py-slang` stdlib group.

```bash
cd python
python -m pip install -e .        # editable install for development
python -m pytest                  # or: PYTHONPATH=. python tests/test_sicp.py
python -m build                   # build the wheel + sdist
```

## License

Apache-2.0. Part of the [Source Academy](https://sourceacademy.org) project.
