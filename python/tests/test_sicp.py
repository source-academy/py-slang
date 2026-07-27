"""Smoke tests for the `sicp` package.

Run with `python -m pytest` (if pytest is installed) or directly with
`python tests/test_sicp.py`.
"""

from sicp import *


def test_pairs_and_linked_lists():
    assert pair(1, 2) == [1, 2]
    assert is_pair([1, 2]) and not is_pair([1, 2, 3])
    assert head(pair("a", "b")) == "a" and tail(pair("a", "b")) == "b"
    assert llist(1, 2, 3) == [1, [2, [3, None]]]
    assert llist() is None
    assert length(llist(1, 2, 3)) == 3


def test_higher_order_linked_list_ops():
    assert map(lambda x: x * x, llist(1, 2, 3)) == llist(1, 4, 9)
    assert filter(lambda x: x % 2 == 1, llist(1, 2, 3, 4, 5)) == llist(1, 3, 5)
    assert reverse(llist(1, 2, 3)) == llist(3, 2, 1)
    assert append(llist(1, 2), llist(3, 4)) == llist(1, 2, 3, 4)
    assert reduce(lambda x, acc: x + acc, 0, llist(1, 2, 3, 4)) == 10


def test_pair_mutation():
    p = pair(1, 2)
    set_head(p, 10)
    set_tail(p, 20)
    assert p == [10, 20]


def test_lists_and_equal():
    assert is_list([1, 2, 3]) and not is_list(None)
    assert list_length([1, 4, 9, 16]) == 4
    assert equal(llist(1, llist(2, 3)), llist(1, llist(2, 3)))
    assert not equal(llist(1, 2), llist(1, 3))


def test_streams():
    assert eval_stream(integers_from(1), 4) == llist(1, 2, 3, 4)
    assert stream_ref(integers_from(10), 5) == 15
    assert eval_stream(stream_map(lambda x: x * x, integers_from(1)), 3) == llist(
        1, 4, 9
    )
    assert is_stream(enum_stream(1, 3))


def test_type_predicates():
    assert is_integer(3) and not is_integer(3.0) and not is_integer(True)
    assert is_float(3.0) and not is_float(3)
    assert is_boolean(True) and not is_boolean(1)
    assert is_string("x") and is_none(None) and is_function(is_none)
    assert is_complex(1 + 2j) and not is_complex(1)
    # is_number mirrors Scheme's number?: true across the numeric tower, not bool
    assert is_number(3) and is_number(3.0) and is_number(1 + 2j)
    assert not is_number(True) and not is_number("3")


def test_large_inputs_avoid_recursion_error():
    """Regression test for functions that used to recurse once per element:
    CPython has no tail-call optimization, so a version that isn't properly
    iterative/lazy raises RecursionError well before this size (the default
    recursion limit is 1000)."""
    n = 5000
    xs = build_llist(lambda i: i, n)
    ys = build_llist(lambda i: i, n)
    assert equal(xs, ys)
    assert not equal(xs, build_llist(lambda i: i + 1, n))

    assert is_stream(enum_stream(1, n))
    assert head(stream_reverse(enum_stream(1, n))) == n
    assert stream_member(n, integers_from(1)) is not None
    assert head(stream_filter(lambda x: x > n, integers_from(1))) == n + 1

    run_of_matches = stream(*([1] * n + [2]))
    assert head(stream_remove_all(1, run_of_matches)) == 2


def test_misc_and_math():
    assert real(3 + 4j) == 3 and imag(3 + 4j) == 4
    assert arity(lambda a, b, c: None) == 3
    assert math_sqrt(4) == 2.0 and math_floor(2.7) == 2
    assert math_pi > 3.14 and math_e > 2.71
    try:
        head(5)
    except Exception:
        pass
    else:
        raise AssertionError("head(5) should raise")


if __name__ == "__main__":
    import traceback

    tests = [
        v for k, v in sorted(globals().items()) if k.startswith("test_") and callable(v)
    ]
    failures = 0
    for t in tests:
        try:
            t()
            print(f"PASS {t.__name__}")
        except Exception:
            failures += 1
            print(f"FAIL {t.__name__}")
            traceback.print_exc()
    print(f"\n{len(tests) - failures}/{len(tests)} passed")
    raise SystemExit(1 if failures else 0)
