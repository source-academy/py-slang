"""Source Academy Python linked-list library, ported to CPython.

Mirrors ``@sourceacademy/py-slang/src/stdlib/linked-list.ts`` (native builtins)
and ``linked-list.prelude.ts`` (book-defined functions). A pair is represented
as a two-element Python list ``[head, tail]`` and the empty list as ``None`` —
the same representation Source Academy Python uses, so results print and compare
directly against the textbook, e.g. ``llist(1, 2, 3)`` -> ``[1, [2, [3, None]]]``.
"""

from .misc import error, is_none

# --------------------------------------------------------------------------
# Native builtins (linked-list.ts)
# --------------------------------------------------------------------------


def pair(a, b):
    return [a, b]


def is_pair(x):
    return isinstance(x, list) and len(x) == 2


def head(p):
    if not is_pair(p):
        error("head expects a pair as argument, but encountered", p)
    return p[0]


def tail(p):
    if not is_pair(p):
        error("tail expects a pair as argument, but encountered", p)
    return p[1]


def llist(*args):
    result = None
    for x in reversed(args):
        result = pair(x, result)
    return result


def _is_llist_shape(xs):
    return xs is None or (is_pair(xs) and _is_llist_shape(xs[1]))


def _print_llist_str(xs):
    if not _is_llist_shape(xs):
        if not is_pair(xs):
            return repr(xs)
        return "[" + _print_llist_str(xs[0]) + ", " + _print_llist_str(xs[1]) + "]"
    parts = []
    current = xs
    while is_pair(current):
        parts.append(_print_llist_str(current[0]))
        current = current[1]
    return "llist(" + ", ".join(parts) + ")"


def print_llist(xs):
    print(_print_llist_str(xs))
    return None


# --------------------------------------------------------------------------
# Prelude (linked-list.prelude.ts) -- book-defined functions
# --------------------------------------------------------------------------


def is_llist(xs):
    if is_none(xs):
        return True
    elif is_pair(xs):
        return is_llist(tail(xs))
    else:
        return False


def length(xs):
    return _length(xs, 0)


def _length(xs, acc):
    return acc if is_none(xs) else _length(tail(xs), acc + 1)


def map(f, xs):
    return _map(f, xs, None)


def _map(f, xs, acc):
    return reverse(acc) if is_none(xs) else _map(f, tail(xs), pair(f(head(xs)), acc))


def build_llist(fun, n):
    return _build_llist(n - 1, fun, None)


def _build_llist(i, fun, already_built):
    return already_built if i < 0 else _build_llist(i - 1, fun, pair(fun(i), already_built))


def for_each(fun, xs):
    if is_none(xs):
        return True
    else:
        fun(head(xs))
        return for_each(fun, tail(xs))


def llist_to_string(xs):
    return _llist_to_string(xs, lambda x: x)


def _llist_to_string(xs, cont):
    if is_none(xs):
        return cont("None")
    elif is_pair(xs):
        return _llist_to_string(
            head(xs),
            lambda x_str: _llist_to_string(
                tail(xs), lambda y_str: cont("[" + x_str + ", " + y_str + "]")
            ),
        )
    else:
        return cont(repr(xs))


def reverse(xs):
    return _reverse(xs, None)


def _reverse(original, reversed_acc):
    return (
        reversed_acc
        if is_none(original)
        else _reverse(tail(original), pair(head(original), reversed_acc))
    )


def append(xs, ys):
    return _append(xs, ys, lambda x: x)


def _append(xs, ys, cont):
    return cont(ys) if is_none(xs) else _append(tail(xs), ys, lambda zs: cont(pair(head(xs), zs)))


def member(v, xs):
    if is_none(xs):
        return None
    elif v == head(xs):
        return xs
    else:
        return member(v, tail(xs))


def remove(v, xs):
    return _remove(v, xs, None)


def _remove(v, xs, acc):
    if is_none(xs):
        return append(reverse(acc), xs)
    elif v == head(xs):
        return append(reverse(acc), tail(xs))
    else:
        return _remove(v, tail(xs), pair(head(xs), acc))


def remove_all(v, xs):
    return _remove_all(v, xs, None)


def _remove_all(v, xs, acc):
    if is_none(xs):
        return append(reverse(acc), xs)
    elif v == head(xs):
        return _remove_all(v, tail(xs), acc)
    else:
        return _remove_all(v, tail(xs), pair(head(xs), acc))


def enum_llist(start, end):
    return _enum_llist(start, end, None)


def _enum_llist(start, end, acc):
    return reverse(acc) if start > end else _enum_llist(start + 1, end, pair(start, acc))


def llist_ref(xs, n):
    if n == 0:
        if is_none(xs):
            error("llist_ref: index out of bounds on None linked list")
        return head(xs)
    else:
        if is_none(xs):
            error("llist_ref: index out of bounds")
        return llist_ref(tail(xs), n - 1)


def reduce(f, initial, xs):
    return _reduce(f, initial, xs, lambda x: x)


def _reduce(f, initial, xs, cont):
    if is_none(xs):
        return cont(initial)
    else:
        return _reduce(
            f,
            initial,
            tail(xs),
            lambda x_reduced_from_tail: cont(f(head(xs), x_reduced_from_tail)),
        )


def filter(pred, xs):
    return _filter(pred, xs, None)


def _filter(pred, xs, acc):
    if is_none(xs):
        return reverse(acc)
    else:
        if pred(head(xs)):
            return _filter(pred, tail(xs), pair(head(xs), acc))
        else:
            return _filter(pred, tail(xs), acc)
