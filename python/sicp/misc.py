"""Source Academy Python ``misc`` builtins, ported to CPython.

Mirrors ``@sourceacademy/py-slang/src/stdlib/misc.ts``. The names that Source
Academy Python inherits unchanged from CPython (``int``, ``float``, ``complex``,
``bool``, ``str``, ``repr``, ``abs``, ``len``, ``max``, ``min``, ``round``,
``print``, ``input``) are intentionally left as the CPython builtins; only the
names Source Academy adds on top are defined here.
"""

import inspect as _inspect
import random as _random
import time as _time


def error(*args):
    """Abort with the given message (Source Academy ``error``)."""
    raise Exception("Error: " + " ".join(str(a) for a in args))


def arity(f):
    """Number of parameters ``f`` accepts. For a variadic function, returns the
    position of its ``*args`` parameter (mirrors Source Academy ``arity``)."""
    if not callable(f):
        error("arity expects a function, but encountered", f)
    try:
        sig = _inspect.signature(f)
    except (ValueError, TypeError):
        error(
            "arity expects a function with an inspectable signature, but encountered", f
        )
    params = list(sig.parameters.values())
    for i, p in enumerate(params):
        if p.kind is _inspect.Parameter.VAR_POSITIONAL:
            return i
    return len(params)


def real(z):
    """Real part of a complex number."""
    if not isinstance(z, complex):
        error("real expects a complex number, but encountered", z)
    return z.real


def imag(z):
    """Imaginary part of a complex number."""
    if not isinstance(z, complex):
        error("imag expects a complex number, but encountered", z)
    return z.imag


def random_random():
    """A pseudo-random float in [0, 1)."""
    return _random.random()


def time_time():
    """Milliseconds since the epoch (mirrors Source Academy ``time_time``,
    which is backed by JavaScript's ``Date.now()``)."""
    return _time.time() * 1000


def is_none(x):
    return x is None


def is_integer(x):
    # bool is a subclass of int, but `type(x) is int` correctly excludes it,
    # matching Source Academy Python where int and bool are distinct types.
    return type(x) is int


def is_float(x):
    return type(x) is float


def is_complex(x):
    return isinstance(x, complex)


def is_number(x):
    # Mirrors Scheme's `number?` primitive (as used in the textbook sources):
    # true for any number in the numeric tower -- integer, float or complex --
    # but not for booleans. Source Academy Python otherwise distinguishes
    # is_integer / is_float / is_complex.
    return is_integer(x) or is_float(x) or is_complex(x)


def is_string(x):
    return isinstance(x, str)


def is_boolean(x):
    return isinstance(x, bool)


def is_function(x):
    return callable(x)
