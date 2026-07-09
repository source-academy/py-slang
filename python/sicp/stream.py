"""Source Academy Python stream library, ported to CPython.

Mirrors ``@sourceacademy/py-slang/src/stdlib/stream.ts`` and
``stream.prelude.ts``. A stream is ``None`` or a pair whose tail is a nullary
function returning the rest of the stream.
"""

from .linked_list import head, is_pair, pair, tail
from .misc import arity, error, is_function, is_none


def stream(*args):
    if len(args) == 0:
        return None
    rest = args[1:]
    return pair(args[0], lambda: stream(*rest))


def stream_tail(xs):
    if is_pair(xs):
        the_tail = tail(xs)
        if is_function(the_tail):
            return the_tail()
        else:
            error(
                "stream_tail(xs) expects a function as the tail of the argument "
                "pair xs, but encountered",
                the_tail,
            )
    else:
        error("stream_tail(xs) expects a pair as argument xs, but encountered", xs)


def is_stream(xs):
    while is_pair(xs):
        the_tail = tail(xs)
        if not (is_function(the_tail) and arity(the_tail) == 0):
            return False
        xs = the_tail()
    return is_none(xs)


def llist_to_stream(xs):
    return None if is_none(xs) else pair(head(xs), lambda: llist_to_stream(tail(xs)))


def stream_to_llist(xs):
    elements = []
    while not is_none(xs):
        elements.append(head(xs))
        xs = stream_tail(xs)
    result = None
    for x in reversed(elements):
        result = pair(x, result)
    return result


def stream_length(xs):
    n = 0
    while not is_none(xs):
        n += 1
        xs = stream_tail(xs)
    return n


def stream_map(f, s):
    return None if is_none(s) else pair(f(head(s)), lambda: stream_map(f, stream_tail(s)))


def build_stream(fun, n):
    def build(i):
        return None if i >= n else pair(fun(i), lambda: build(i + 1))

    return build(0)


def stream_for_each(fun, xs):
    while not is_none(xs):
        fun(head(xs))
        xs = stream_tail(xs)
    return True


def stream_reverse(xs):
    reversed_acc = None
    while not is_none(xs):
        # Default argument binds the *current* reversed_acc at each iteration;
        # a plain `lambda: reversed_acc` would all share the loop variable and
        # see only its final value once forced.
        reversed_acc = pair(head(xs), lambda acc=reversed_acc: acc)
        xs = stream_tail(xs)
    return reversed_acc


def stream_append(xs, ys):
    return ys if is_none(xs) else pair(head(xs), lambda: stream_append(stream_tail(xs), ys))


def stream_member(x, s):
    while not is_none(s):
        if head(s) == x:
            return s
        s = stream_tail(s)
    return None


def stream_remove(v, xs):
    return (
        None
        if is_none(xs)
        else stream_tail(xs)
        if v == head(xs)
        else pair(head(xs), lambda: stream_remove(v, stream_tail(xs)))
    )


def stream_remove_all(v, xs):
    # Skip a run of matching elements iteratively rather than recursing once
    # per removed element, then defer to the next call the same way
    # stream_map/stream_filter do, so the result stays lazy.
    while not is_none(xs) and v == head(xs):
        xs = stream_tail(xs)
    if is_none(xs):
        return None
    return pair(head(xs), lambda: stream_remove_all(v, stream_tail(xs)))


def stream_filter(p, s):
    # Skip non-matching elements iteratively (the same shape as
    # stream_remove_all above), then defer the rest lazily so filtering an
    # infinite stream still works.
    while not is_none(s) and not p(head(s)):
        s = stream_tail(s)
    if is_none(s):
        return None
    return pair(head(s), lambda: stream_filter(p, stream_tail(s)))


def enum_stream(start, end):
    return None if start > end else pair(start, lambda: enum_stream(start + 1, end))


def integers_from(n):
    return pair(n, lambda: integers_from(n + 1))


def eval_stream(s, n):
    if n < 0:
        error("eval_stream expects a nonnegative count, but encountered", n)
    elements = []
    while n > 0 and not is_none(s):
        elements.append(head(s))
        s = stream_tail(s)
        n -= 1
    result = None
    for x in reversed(elements):
        result = pair(x, result)
    return result


def stream_ref(s, n):
    if n < 0:
        error("stream_ref: index out of bounds")
    while n > 0:
        s = stream_tail(s)
        n -= 1
    return head(s)
