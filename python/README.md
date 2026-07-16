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
print(list_length([1, 4, 9, 16, 25]))                # 5
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
| `sicp.list`          | `is_list`, `list_length`, `equal` |
| `sicp.stream`        | `stream`, `stream_map`, `stream_filter`, `stream_ref`, `integers_from`, `eval_stream`, … |

`from sicp import *` brings the whole superset into scope, mirroring the
environment students have in Source Academy's Python.

For the full documentation of every function — signatures, descriptions, and
worked examples — see the **[Python §4 standard library
reference](https://docs.sourceacademy.org/python/python_4/)**. Its groups (MISC,
MATH, LINKED LISTS, PAIR MUTATORS, LISTS, STREAM, MCE) correspond to the
`sicp.<group>` submodules above.

## Compatibility

- Requires Python 3.10+.
- `is_number` mirrors Scheme's `number?` primitive as used in the textbook.
- `round`, `abs`, `len`, `max`, `min`, `str`, `repr`, `int`, `float`, `complex`,
  `bool`, `print`, and `input` are plain CPython builtins, not reimplementations
  of Source Academy Python's versions, so a few edge cases differ:
  - `arity()` raises on a handful of CPython builtins whose signature isn't
    introspectable (e.g. `arity(print)`, `arity(max)`, `arity(min)`,
    `arity(str)`), where Source Academy Python's own `arity` returns a value.
  - `is_function(int)` and `is_function(str)` are `True` here, since CPython's
    `callable()` treats classes as callable — Source Academy Python's
    tag-based check would say `False`.
  - `max`/`min` accept the single-iterable form (`max([1, 2, 3])`); Source
    Academy Python's versions require two or more direct arguments.

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

## Releasing

Publishing to PyPI is **not** automatic on push or merge. The CI `test` job runs
on every change under `python/**`, but the `publish` job runs **only when a
GitHub Release is published** (`.github/workflows/python-package.yml`).

One-time setup: configure a [PyPI Trusted
Publisher](https://docs.pypi.org/trusted-publishers/) for the
`sourceacademy-sicp` project pointing at this repository and the
`python-package` workflow (or swap the publish step for a token-based upload).

To cut a release:

1. Bump `version` in `pyproject.toml`. PyPI rejects re-uploads of an existing
   version, so this must change every time.
2. Merge to `main`.
3. Create and publish a [GitHub
   Release](https://github.com/source-academy/py-slang/releases/new) (a tag such
   as `sicp-vX.Y.Z`). Publishing it triggers the `publish` job, which builds the
   wheel + sdist and uploads them to PyPI.

## License

Apache-2.0. Part of the [Source Academy](https://sourceacademy.org) project.
