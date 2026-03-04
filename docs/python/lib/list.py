def pair(x, y):
    """
    PRIMITIVE
    Makes a pair whose head (first component) is x and whose
    tail (second component) is y.

    Parameters:
        x (value): given head
        y (value): given tail

    Returns:
        pair: pair with x as head and y as tail
    """
    pass


def is_pair(x):
    """
    PRIMITIVE
    Returns true if x is a pair and false otherwise.

    Parameters:
        x (value): given value

    Returns:
        boolean: whether x is a pair
    """
    pass


def head(p):
    """
    PRIMITIVE
    Returns head (first component) of given pair p.

    Parameters:
        p (pair): given pair

    Returns:
        value: head of p
    """
    pass


def tail(p):
    """
    PRIMITIVE
    Returns tail (second component of given pair p.

    Parameters:
        p (pair): given pair

    Returns:
        value: tail of p
    """
    pass


def is_none(x):
    """
    PRIMITIVE
    Returns true if x is the empty linked list None, and false otherwise.

    Parameters:
        x (value): given value

    Returns:
        boolean: whether x is None
    """
    pass


def is_linked_list(xs):
    """
    PRIMITIVE
    Returns true if xs is a linked list as defined in the textbook, and
    false otherwise.

    Parameters:
        xs (value): given value

    Returns:
        boolean: whether xs is a linked list
    """
    pass


def linked_list(value1, value2, *values):
    """
    PRIMITIVE
    Given n values, returns a linked list of length n. The elements of
    the linked list are the given values in the given order.

    Parameters:
        value1 (value1, value2, ...values): given values

    Returns:
        linked list: linked list containing all values
    """
    pass


def draw_data(value1, value2, *values):
    """
    PRIMITIVE
    Visualizes the arguments in a separate drawing area in the Source
    Academy using box-and-pointer diagrams.

    Parameters:
        value1 (value1, value2, ...values): given values
    """
    pass


def equal(xs, ys):
    """
    Pure Function: Returns true if both have the same structure (pairs)
    and identical values at corresponding leaf positions.
    """
    if is_pair(xs):
        return (
            is_pair(ys)
            and equal(head(xs), head(ys))
            and equal(tail(xs), tail(ys))
        )
    elif is_none(xs):
        return is_none(ys)
    elif is_number(xs):
        return is_number(ys) and xs == ys
    elif is_boolean(xs):
        return is_boolean(ys) and xs == ys
    elif is_string(xs):
        return is_string(ys) and xs == ys
    elif is_undefined(xs):  # Catches None in Python
        return is_undefined(ys)
    elif is_function(xs):
        return is_function(ys) and xs == ys
    else:
        return xs == ys


def length(xs):
    """
    Returns the length of the linked list xs.
    """
    return _length(xs, 0)


def _length(xs, acc):
    return acc if is_none(xs) else _length(tail(xs), acc + 1)


def map_linked_list(f, xs):
    """
    Returns a linked list that results from linked list xs by element-wise
    application of unary function f.
    """
    return _map_linked_list(f, xs, None)


def _map_linked_list(f, xs, acc):
    return (
        reverse(acc)
        if is_none(xs)
        else _map_linked_list(f, tail(xs), pair(f(head(xs)), acc))
    )


def build_linked_list(fun, n):
    """
    Makes a linked list with n elements by applying the unary function fun
    to the numbers 0 to n - 1.
    """
    return _build_linked_list(n - 1, fun, None)


def _build_linked_list(i, fun, already_built):
    return (
        already_built
        if i < 0
        else _build_linked_list(i - 1, fun, pair(fun(i), already_built))
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


def linked_list_to_string(xs):
    """
    Returns a string that represents linked list xs using the text-based
    box-and-pointer notation.
    """
    return _linked_list_to_string(xs, lambda x: x)


def _linked_list_to_string(xs, cont):
    if is_none(xs):
        return cont("null")
    elif is_pair(xs):
        return _linked_list_to_string(
            head(xs),
            lambda x_str: _linked_list_to_string(
                tail(xs), lambda y_str: cont(f"[{x_str},{y_str}]")
            ),
        )
    else:
        return cont(stringify(xs))


def reverse(xs):
    """
    Returns linked list xs in reverse order.
    """
    return _reverse(xs, None)


def _reverse(original, reversed_acc):
    return (
        reversed_acc
        if is_none(original)
        else _reverse(tail(original), pair(head(original), reversed_acc))
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
        else _append(tail(xs), ys, lambda zs: cont(pair(head(xs), zs)))
    )


def member(v, xs):
    """
    Returns first postfix sub-linked list whose head is identical to v
    (using ==). Returns null if the element does not occur in the linked
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


def enum_linked_list(start, end):
    """
    Makes a linked list with elements from start to end (inclusive).
    """
    return _enum_linked_list(start, end, None)


def _enum_linked_list(start, end, acc):
    return (
        reverse(acc)
        if start > end
        else _enum_linked_list(start + 1, end, pair(start, acc))
    )


def list_ref(xs, n):
    """
    Returns the element of linked list xs at position n (0-indexed).
    """
    if n == 0:
        if is_none(xs):
            raise IndexError(
                "linked_list_ref: index out of bounds on null linked list"
            )
        return head(xs)
    else:
        if is_none(xs):
            raise IndexError("linked_list_ref: index out of bounds")
        return list_ref(tail(xs), n - 1)


def accumulate_linked_list(f, initial, xs):
    """
    Applies binary function f to the elements of xs from right-to-left
    order.
    """
    return _accumulate_linked_list(f, initial, xs, lambda x: x)


def _accumulate_linked_list(f, initial, xs, cont):
    if is_none(xs):
        return cont(initial)
    else:
        # Recursive CPS call: Process tail, then apply f with head,
        # then pass to continuation
        return _accumulate_linked_list(
            f,
            initial,
            tail(xs),
            lambda x_accumulated_from_tail: cont(
                f(head(xs), x_accumulated_from_tail)
            ),
        )


def filter_linked_list(pred, xs):
    """
    Returns a linked list that contains only those elements for which the
    one-argument function pred returns true.
    """
    return _filter_linked_list(pred, xs, None)


def _filter_linked_list(pred, xs, acc):
    if is_none(xs):
        return reverse(acc)
    else:
        if pred(head(xs)):
            return _filter_linked_list(pred, tail(xs), pair(head(xs), acc))
        else:
            return _filter_linked_list(pred, tail(xs), acc)
