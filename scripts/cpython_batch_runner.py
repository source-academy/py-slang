#!/usr/bin/env python3
"""Batch CPython runner for py-slang's own Jest test suite (issue #224).

Reads a JSON array of test cases from stdin, each `{"id", "code"}`, and writes
a JSON array of results to stdout, each:

    {"id": ..., "output": [<printed lines>], "error": <exception name> | None,
     "result": <serialized value> | None}

`code` is executed with the Source Academy Python standard library
(`sicp`, from ../python/) in scope, exactly like `from sicp import *`. If the
program's last top-level statement is a bare expression, its value is
captured (mirroring how the CSE machine test harness observes the last value
popped off the stash) -- otherwise `result` is null, matching a value-less
statement.

One process, one `sicp` import, reused across every case (a fresh globals
dict per case) -- spawning a subprocess per case would dominate the runtime
for a suite with thousands of cases.
"""

import ast
import contextlib
import io
import json
import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "python"))

try:
    import sicp
except ModuleNotFoundError:
    sys.stderr.write(
        "cpython_batch_runner: the `sicp` package is not importable from "
        + os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "python")
        + " -- this should never happen when run from this repo checkout.\n"
    )
    sys.exit(1)

BASE_GLOBALS = {}
exec("from sicp import *", BASE_GLOBALS)

RESULT_MARKER = "__cpython_batch_runner_result__"


def compile_capturing_last_expression(code, case_id):
    """Compiles `code` so that, if its last top-level statement is a bare
    expression, its value is captured into RESULT_MARKER instead of being
    discarded -- exec() has no REPL-style auto-display of the final value."""
    tree = ast.parse(code, filename=f"<case {case_id}>")
    if tree.body and isinstance(tree.body[-1], ast.Expr):
        last = tree.body[-1]
        assign = ast.Assign(
            targets=[ast.Name(id=RESULT_MARKER, ctx=ast.Store())],
            value=last.value,
        )
        ast.copy_location(assign, last)
        ast.fix_missing_locations(assign)
        tree.body[-1] = assign
    return compile(tree, filename=f"<case {case_id}>", mode="exec")


def serialize_value(value, _depth=0):
    """Converts a CPython value to a JSON-comparable shape matching py-slang's
    own TestOutputValue union (bigint/number/boolean/string/null/complex/array).
    Depth-limited and falls back to a repr-only "other" tag for anything else
    (functions, pairs represented as 2-element lists that aren't proper
    Source-Academy "lists", etc.) -- those cases are excluded from strict value
    comparison on the TypeScript side, same as the native-Pynter runner does
    for values it can't decode."""
    if _depth > 50:
        return {"type": "other", "repr": repr(value)}
    if value is None:
        return {"type": "none"}
    if isinstance(value, bool):
        return {"type": "bool", "value": value}
    if isinstance(value, int):
        return {"type": "int", "value": str(value)}
    if isinstance(value, float):
        if math.isnan(value):
            return {"type": "float", "value": "nan"}
        if math.isinf(value):
            return {"type": "float", "value": "inf" if value > 0 else "-inf"}
        return {"type": "float", "value": value}
    if isinstance(value, complex):
        return {
            "type": "complex",
            "value": {
                "real": serialize_value(value.real, _depth + 1)["value"],
                "imag": serialize_value(value.imag, _depth + 1)["value"],
            },
        }
    if isinstance(value, str):
        return {"type": "str", "value": value}
    if isinstance(value, list):
        return {"type": "list", "value": [serialize_value(v, _depth + 1) for v in value]}
    return {"type": "other", "repr": repr(value)}


def run_case(case):
    globs = dict(BASE_GLOBALS)
    buf = io.StringIO()
    try:
        compiled = compile_capturing_last_expression(case["code"], case["id"])
    except SyntaxError as error:
        return {
            "id": case["id"],
            "output": [],
            "error": f"SyntaxError: {error}",
            "result": None,
        }

    try:
        with contextlib.redirect_stdout(buf):
            exec(compiled, globs)
    except BaseException as error:  # noqa: BLE001 -- must not crash the batch
        return {
            "id": case["id"],
            "output": buf.getvalue().splitlines(),
            "error": f"{type(error).__name__}: {error}",
            "result": None,
        }

    result = globs.get(RESULT_MARKER, None)
    return {
        "id": case["id"],
        "output": buf.getvalue().splitlines(),
        "error": None,
        "result": serialize_value(result),
    }


def main():
    cases = json.load(sys.stdin)
    sys.stdout.write(json.dumps([run_case(case) for case in cases]))
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
