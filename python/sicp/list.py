"""Source Academy Python ``list`` library, ported to CPython.

Mirrors ``@sourceacademy/py-slang/src/stdlib/list.ts`` and ``list.prelude.ts``.
In Source Academy Python a "list" is an ordinary mutable sequence; note that a
two-element list is therefore also a pair, exactly as in Source Academy Python.
This module also defines the authoritative ``equal`` (the ``list`` group is
loaded after ``linked-list``, so its ``equal`` is the one in effect).
"""

from .linked_list import head, is_pair, tail
from .misc import (
    error,
    is_boolean,
    is_float,
    is_function,
    is_integer,
    is_none,
    is_string,
)


def is_list(x):
    return isinstance(x, list)


def list_length(xs):
    if not is_list(xs):
        error("list_length expects a list as argument, but encountered", xs)
    return len(xs)


def equal(xs, ys):
    while is_pair(xs):
        if not is_pair(ys) or not equal(head(xs), head(ys)):
            return False
        xs = tail(xs)
        ys = tail(ys)
    if is_none(xs):
        return is_none(ys)
    elif is_integer(xs) or is_float(xs):
        return (is_integer(ys) or is_float(ys)) and xs == ys
    elif is_boolean(xs):
        return is_boolean(ys) and ((xs and ys) or (not xs and not ys))
    elif is_string(xs):
        return is_string(ys) and xs == ys
    elif is_function(xs):
        return is_function(ys) and xs == ys
    elif is_list(xs):
        if not is_list(ys) or list_length(xs) != list_length(ys):
            return False
        i = 0
        while i < list_length(xs):
            if not equal(xs[i], ys[i]):
                return False
            i = i + 1
        return True
    else:
        return False
