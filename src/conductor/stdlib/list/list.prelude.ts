export const listPrelude = `
def equal(xs, ys):
    """
    Pure Function: Returns true if both have the same structure (pairs)
    and identical values at corresponding leaf positions.
    """
    if is_pair(xs):
        return is_pair(ys) and \
               equal(head(xs), head(ys)) and \
               equal(tail(xs), tail(ys))
    elif is_null(xs):
        return is_null(ys)
    elif is_number(xs):
        return is_number(ys) and xs == ys
    elif is_boolean(xs):
        return is_boolean(ys) and xs == ys
    elif is_string(xs):
        return is_string(ys) and xs == ys
    elif is_undefined(xs): # Catches None in Python
        return is_undefined(ys)
    elif is_function(xs):
        return is_function(ys) and xs == ys
    else:
        return xs == ys

def _length(xs, acc):
    """
    Helper for length, designed for Tail Recursion.
    """
    return acc if is_null(xs) else _length(tail(xs), acc + 1)

def length(xs):
    """
    Returns the length of the list xs.
    """
    return _length(xs, 0)

def _map(f, xs, acc):
    return reverse(acc) if is_null(xs) else _map(f, tail(xs), pair(f(head(xs)), acc))

def map(f, xs):
    """
    Returns a list that results from list xs by element-wise application of unary function f.
    """
    return _map(f, xs, None)

def _build_list(i, fun, already_built):
    return already_built if i < 0 else _build_list(i - 1, fun, pair(fun(i), already_built))

def build_list(fun, n):
    """
    Makes a list with n elements by applying the unary function fun
    to the numbers 0 to n - 1.
    """
    return _build_list(n - 1, fun, None)

def for_each(fun, xs):
    """
    Applies the unary function fun to every element of the list xs.
    """
    if is_null(xs):
        return True
    else:
        fun(head(xs)) # Side effect happens here if fun is not pure
        return for_each(fun, tail(xs))

def list_to_string(xs):
    """
    Returns a string that represents list xs using the text-based box-and-pointer notation.
    """
    return _list_to_string(xs, lambda x: x)

def _list_to_string(xs, cont):
    if is_null(xs):
        return cont('null')
    elif is_pair(xs):
        return _list_to_string(head(xs), lambda x_str:
               _list_to_string(tail(xs), lambda y_str:
               cont(f'[{x_str},{y_str}]')
        ))
    else:
        return cont(stringify(xs))
        
def list_to_string(xs):
    """
    Returns a string that represents list xs using the text-based box-and-pointer notation.
    """
    return _list_to_string(xs, lambda x: x)

def _reverse(original, reversed_acc):
    return reversed_acc if is_null(original) else _reverse_iter(tail(original), pair(head(original), reversed_acc))

def reverse(xs):
    """
    Returns list xs in reverse order.
    """
    return _reverse_iter(xs, None)

def _append(xs, ys, cont):
    return cont(ys) if is_null(xs) else _append(tail(xs), ys, lambda zs: cont(pair(head(xs), zs)))

def append(xs, ys):
    """
    Returns a list that results from appending the list ys to the list xs.
    """
    return _append(xs, ys, lambda x: x)

def member(v, xs):
    """
    Returns first postfix sublist whose head is identical to v (using ===).
    Returns null if the element does not occur in the list.
    """
    if is_null(xs):
        return None
    elif v == head(xs):
        return xs
    else:
        return member(v, tail(xs))

def _remove(v, xs, acc):
    if is_null(xs):
        return append(reverse(acc), xs) 
    elif v == head(xs):
        return append(reverse(acc), tail(xs))
    else:
        return _remove(v, tail(xs), pair(head(xs), acc))

def remove(v, xs):
    """
    Returns a list that results from xs by removing the first item from xs that is identical (===) to v.
    """
    return _remove(v, xs, None)

def _remove_all(v, xs, acc):
    if is_null(xs):
        return append(reverse(acc), xs) 
    elif v == head(xs):
        return _remove_all(v, tail(xs), acc)
    else:
        return _remove_all(v, tail(xs), pair(head(xs), acc))

def remove_all(v, xs):
    """
    Returns a list that results from xs by removing all items from xs that are identical (===) to v.
    """
    return _remove_all(v, xs, None)

def _enum_list(start, end, acc):
    return reverse(acc) if start > end else _enum_list(start + 1, end, pair(start, acc))

def enum_list(start, end):
    """
    Makes a list with elements from start to end (inclusive).
    """
    return _enum_list(start, end, None)

def list_ref(xs, n):
    """
    Returns the element of list xs at position n (0-indexed).
    """
    if n == 0:
        if is_null(xs): raise IndexError("list_ref: index out of bounds on null list")
        return head(xs)
    else:
        if is_null(xs): raise IndexError("list_ref: index out of bounds")
        return list_ref(tail(xs), n - 1)

def _accumulate(f, initial, xs, cont):
    if is_null(xs):
        return cont(initial)
    else:
        # Recursive CPS call: Process tail, then apply f with head, then pass to continuation
        return _accumulate(f, initial, tail(xs), lambda x_accumulated_from_tail:
               cont(f(head(xs), x_accumulated_from_tail)))

def accumulate(f, initial, xs):
    """
    Applies binary function f to the elements of xs from right-to-left order.
    """
    return _accumulate(f, initial, xs, lambda x: x)

def _filter(pred, xs, acc): 
    if is_null(xs):
        return reverse(acc)
    else:
        if pred(head(xs)):
            return _filter(pred, tail(xs), pair(head(xs), acc))
        else:
            return _filter(pred, tail(xs), acc)

def filter(pred, xs):
    """
    Returns a list that contains only those elements for which the one-argument
    function pred returns true.
    """
    return _filter(pred, xs, None)
`;