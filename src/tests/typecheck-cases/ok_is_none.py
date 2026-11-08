# Clean if is_none narrows: the Source idiom is is_none(xs) rather than `xs is None`.
def sum_llist(xs: LList[int]) -> int:
    return 0 if is_none(xs) else head(xs) + sum_llist(tail(xs))
