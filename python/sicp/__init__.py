"""The ``sicp`` runtime: the Source Academy Python standard library for CPython.

Running ``from sicp import *`` brings the whole Source Academy Python standard
library into scope, so a program written for Source Academy's Python (as in
CS1101S / the SICP Python edition) runs the same way under plain CPython. It is
used both as an installable package for students and to test the textbook's
example programs against CPython.

The library is assembled from submodules, each mirroring a group in
``@sourceacademy/py-slang/src/stdlib``:

    sicp.misc          misc.ts          error, arity, is_* predicates, real, imag, ...
    sicp.math          math.ts          math_pi, math_sqrt, ... (the math_* names)
    sicp.linked_list   linked-list.ts   pair, head, tail, llist, map, filter, ...
    sicp.pair_mutators pairmutator.ts   set_head, set_tail
    sicp.list          list.ts          is_list, list_length, equal, build_list
    sicp.stream        stream.ts        stream, stream_map, integers_from, ...
    sicp.mce           (mce group)      apply_in_underlying_python

Representation note: a linked-list pair is a two-element Python list
``[head, tail]`` and the empty list is ``None``, matching Source Academy Python.
With this representation a program's result prints and compares directly against
the textbook, e.g.::

    pair("python_number", 9)        -> ['python_number', 9]
    llist(1, 2, 3)                  -> [1, [2, [3, None]]]

The load order matters: ``sicp.list`` is imported after ``sicp.linked_list`` so
that its ``equal`` is the one in effect, exactly as in Source Academy Python.
"""

from .misc import *  # noqa: F401,F403
from .math import *  # noqa: F401,F403
from .linked_list import *  # noqa: F401,F403
from .pair_mutators import *  # noqa: F401,F403
from .list import *  # noqa: F401,F403
from .stream import *  # noqa: F401,F403
from .mce import *  # noqa: F401,F403
