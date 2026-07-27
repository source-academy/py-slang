"""Source Academy Python linked-list library, ported to CPython.

Mirrors ``@sourceacademy/py-slang/src/stdlib/linked-list.ts`` (native builtins)
and ``linked-list.prelude.ts`` (book-defined functions). A pair is represented
as a two-element Python list ``[head, tail]`` and the empty list as ``None`` --
the same representation Source Academy Python uses, so results print and compare
directly against the textbook, e.g. ``llist(1, 2, 3)`` -> ``[1, [2, [3, None]]]``.

The prelude functions are defined iteratively rather than with the textbook's
tail recursion: CPython has no tail-call optimization, so a recursive version
would raise ``RecursionError`` on lists of ~1000 or more elements.
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
    while is_pair(xs):
        xs = tail(xs)
    return is_none(xs)


def length(xs):
    n = 0
    while not is_none(xs):
        n += 1
        xs = tail(xs)
    return n


def map(f, xs):
    acc = None
    while not is_none(xs):
        acc = pair(f(head(xs)), acc)
        xs = tail(xs)
    return reverse(acc)


def build_llist(fun, n):
    # py-slang's own build_llist (linked-list.prelude.ts) does not validate n >= 0 -- for any
    # n <= 0, range(n - 1, -1, -1) is empty and this silently returns None, matching that. Found
    # by the CPython test mode (issue #224): this used to raise instead.
    result = None
    for i in range(n - 1, -1, -1):
        result = pair(fun(i), result)
    return result


def for_each(fun, xs):
    while not is_none(xs):
        fun(head(xs))
        xs = tail(xs)
    return True


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
    reversed_acc = None
    while not is_none(xs):
        reversed_acc = pair(head(xs), reversed_acc)
        xs = tail(xs)
    return reversed_acc


def append(xs, ys):
    elements = []
    while not is_none(xs):
        elements.append(head(xs))
        xs = tail(xs)
    result = ys
    for x in reversed(elements):
        result = pair(x, result)
    return result


def member(v, xs):
    while not is_none(xs):
        if v == head(xs):
            return xs
        xs = tail(xs)
    return None


def remove(v, xs):
    acc = None
    while not is_none(xs):
        if v == head(xs):
            return append(reverse(acc), tail(xs))
        acc = pair(head(xs), acc)
        xs = tail(xs)
    return reverse(acc)


def remove_all(v, xs):
    acc = None
    while not is_none(xs):
        if v != head(xs):
            acc = pair(head(xs), acc)
        xs = tail(xs)
    return reverse(acc)


def enum_llist(start, end):
    result = None
    for x in range(end, start - 1, -1):
        result = pair(x, result)
    return result


def llist_ref(xs, n):
    if n < 0:
        error("llist_ref: index out of bounds")
    while n > 0:
        if is_none(xs):
            error("llist_ref: index out of bounds")
        xs = tail(xs)
        n -= 1
    if is_none(xs):
        error("llist_ref: index out of bounds on None linked list")
    return head(xs)


def reduce(f, initial, xs):
    elements = []
    while not is_none(xs):
        elements.append(head(xs))
        xs = tail(xs)
    result = initial
    for x in reversed(elements):
        result = f(x, result)
    return result


def filter(pred, xs):
    acc = None
    while not is_none(xs):
        if pred(head(xs)):
            acc = pair(head(xs), acc)
        xs = tail(xs)
    return reverse(acc)
