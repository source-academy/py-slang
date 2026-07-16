"""Source Academy Python pair mutators, ported to CPython.

Mirrors ``@sourceacademy/py-slang/src/stdlib/pairmutator.ts``.
"""

from .linked_list import is_pair
from .misc import error


def set_head(p, value):
    if not is_pair(p):
        error("set_head expects a pair as argument, but encountered", p)
    p[0] = value
    return None


def set_tail(p, value):
    if not is_pair(p):
        error("set_tail expects a pair as argument, but encountered", p)
    p[1] = value
    return None
