"""The names that a program of Typed Python §4 uses in its type annotations.

CPython evaluates the annotations of a function when its ``def`` runs, so the
names in them have to exist: ``def length(xs: LList[int]) -> int`` fails with a
``NameError`` without ``LList``. These names have no behaviour. They are for the
type checker, which gives them their meaning (``src/typecheck/prelude.pyi`` in
py-slang), and for annotations; a program never creates a value of them.

A pair is a list of two elements at run time, as the module ``linked_list``
says, but its type is not a list: ``Pair[int, str]`` has a head of type ``int``
and a tail of type ``str``. A linked list is ``None`` or a pair whose tail is a
linked list, and a stream is ``None`` or a pair whose tail is a function that
returns the rest of the stream.

They are written as aliases of ``typing``, and not with the ``type`` statement
(Python 3.12), because this package supports Python 3.10 and later.
"""

from typing import Callable, Generic, Optional, TypeVar

__all__ = ["Callable", "LList", "Pair", "Stream"]

_H = TypeVar("_H")
_T = TypeVar("_T")
_X = TypeVar("_X")


class Pair(Generic[_H, _T]):
    """The type of a pair. At run time a pair is a list ``[head, tail]``."""


LList = Optional[Pair[_X, "LList[_X]"]]
"""The type of a linked list with elements of type ``X``: ``LList[int]``."""

Stream = Optional[Pair[_X, Callable[[], "Stream[_X]"]]]
"""The type of a stream with elements of type ``X``: ``Stream[int]``."""
