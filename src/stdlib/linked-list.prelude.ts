export default `

def is_llist(xs):
    """
    Returns True if xs is a linked list as defined in the textbook, and
    False otherwise.

    Parameters:
        xs (value): given value

    Returns:
        boolean: whether xs is a linked list
    """
    if is_none(xs):
        return True
    elif is_pair(xs):
        return is_llist(tail(xs))
    else:
        return False

def length(xs):
    """
    Returns the length of the linked list xs.
    """
    return _length(xs, 0)

def _length(xs, acc):
    return acc if is_none(xs) else _length(tail(xs), acc + 1)

def map(f, xs):
    """
    Returns a linked list that results from linked list xs by element-wise
    application of unary function f.
    """
    return _map(f, xs, None)

def _map(f, xs, acc):
    return (
        reverse(acc)
        if is_none(xs)
        else _map(f, tail(xs), pair(f(head(xs)), acc))
    )

def build_llist(fun, n):
    """
    Makes a linked list with n elements by applying the unary function fun
    to the numbers 0 to n - 1.
    """
    return _build_llist(n - 1, fun, None)

def _build_llist(i, fun, already_built):
    return (
        already_built
        if i < 0
        else _build_llist(i - 1, fun, pair(fun(i), already_built))
    )

def for_each(fun, xs):
    """
    Applies the unary function fun to every element of the linked list xs.
    """
    if is_none(xs):
        return True
    else:
        fun(head(xs))  # Side effect happens here if fun is not pure
        return for_each(fun, tail(xs))

def llist_to_string(xs):
    """
    Returns a string that represents linked list xs using the text-based
    box-and-pointer notation.
    """
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
    """
    Returns linked list xs in reverse order.
    """
    return _reverse(xs, None)

def _reverse(original, reversed_acc):
    return (
        reversed_acc
        if is_none(original)
        else _reverse(
            tail(original), pair(head(original), reversed_acc)
        )
    )

def append(xs, ys):
    """
    Returns a linked list that results from appending the linked list ys
    to the linked list xs.
    """
    return _append(xs, ys, lambda x: x)

def _append(xs, ys, cont):
    return (
        cont(ys)
        if is_none(xs)
        else _append(
            tail(xs), ys, lambda zs: cont(pair(head(xs), zs))
        )
    )

def member(v, xs):
    """
    Returns first postfix sub-linked list whose head is identical to v
    (using ==). Returns None if the element does not occur in the linked
    list.
    """
    if is_none(xs):
        return None
    elif v == head(xs):
        return xs
    else:
        return member(v, tail(xs))

def remove(v, xs):
    """
    Returns a linked list that results from xs by removing the first item
    from xs that is identical (==) to v.
    """
    return _remove(v, xs, None)

def _remove(v, xs, acc):
    if is_none(xs):
        return append(reverse(acc), xs)
    elif v == head(xs):
        return append(reverse(acc), tail(xs))
    else:
        return _remove(v, tail(xs), pair(head(xs), acc))

def remove_all(v, xs):
    """
    Returns a linked list that results from xs by removing all items from
    xs that are identical (==) to v.
    """
    return _remove_all(v, xs, None)

def _remove_all(v, xs, acc):
    if is_none(xs):
        return append(reverse(acc), xs)
    elif v == head(xs):
        return _remove_all(v, tail(xs), acc)
    else:
        return _remove_all(v, tail(xs), pair(head(xs), acc))

def enum_llist(start, end):
    """
    Makes a linked list with elements from start to end (inclusive).
    """
    return _enum_llist(start, end, None)

def _enum_llist(start, end, acc):
    return (
        reverse(acc)
        if start > end
        else _enum_llist(start + 1, end, pair(start, acc))
    )

def llist_ref(xs, n):
    """
    Returns the element of linked list xs at position n (0-indexed).
    """
    if n == 0:
        if is_none(xs):
            error("llist_ref: index out of bounds on None linked list")
        return head(xs)
    else:
        if is_none(xs):
            error("llist_ref: index out of bounds")
        return llist_ref(tail(xs), n - 1)

def reduce(f, initial, xs):
    """
    Applies binary function f to the elements of xs from right-to-left
    order.
    """
    return _reduce(f, initial, xs, lambda x: x)

def _reduce(f, initial, xs, cont):
    if is_none(xs):
        return cont(initial)
    else:
        # Recursive CPS call: Process tail, then apply f with head,
        # then pass to continuation
        return _reduce(
            f,
            initial,
            tail(xs),
            lambda x_reduced_from_tail: cont(
                f(head(xs), x_reduced_from_tail)
            ),
        )

def filter(pred, xs):
    """
    Returns a linked list that contains only those elements for which the
    one-argument function pred returns True.
    """
    return _filter(pred, xs, None)

def _filter(pred, xs, acc):
    if is_none(xs):
        return reverse(acc)
    else:
        if pred(head(xs)):
            return _filter(pred, tail(xs), pair(head(xs), acc))
        else:
            return _filter(pred, tail(xs), acc)
`;
