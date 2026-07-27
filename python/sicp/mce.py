"""Metacircular-evaluator helper (Source Academy Python ``mce`` group)."""

from .linked_list import head, tail


def apply_in_underlying_python(fun, args_list):
    """Apply ``fun`` to the elements of the linked list ``args_list``."""
    args = []
    while args_list is not None:
        args.append(head(args_list))
        args_list = tail(args_list)
    return fun(*args)


# The JavaScript edition names this primitive after its host language; keep the
# alias available for programs converted from the JS edition.
apply_in_underlying_javascript = apply_in_underlying_python
