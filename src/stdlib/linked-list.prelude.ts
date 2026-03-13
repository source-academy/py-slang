export default `
# equal computes the structural equality over its arguments
def equal(xs, ys):
    if is_pair(xs):
        return (is_pair(ys) and 
                equal(head(xs), head(ys)) and 
                equal(tail(xs), tail(ys)))
    elif is_none(xs):
        return is_none(ys)
    elif is_int(xs) or is_float(xs):
        return (is_int(ys) or is_float(ys)) and xs == ys
    elif is_boolean(xs):
        return is_boolean(ys) and ((xs and ys) or (not xs and not ys))
    elif is_string(xs):
        return is_string(ys) and xs == ys
    elif is_function(xs):
        return is_function(ys) and xs == ys
    else:
        return False

#recursively checks if the given argument is linked_list
def is_linked_list(xs):
    if is_none(xs):
        return True
    else: 
        if is_pair(xs):
            return is_linked_list(tail(xs))
        else:
            return False


# returns the length of a given argument linked_list
def _length(xs, acc):
    return acc if is_none(xs) else _length(tail(xs), acc + 1)

def length(xs):
    return _length(xs, 0)

def _map_linked_list(f, xs, acc):
    return reverse(acc) if is_none(xs) else _map_linked_list(f, tail(xs), pair(f(head(xs)), acc))

# map applies first arg f to the elements of the second argument xs
def map_linked_list(f, xs):
    return _map_linked_list(f, xs, None)

def _build_linked_list(i, fun, already_built):
    return already_built if i < 0 else _build_linked_list(i - 1, fun, pair(fun(i), already_built))

# build_linked_list takes a function fun and a nonnegative integer n
def build_linked_list(fun, n):
    return _build_linked_list(n - 1, fun, None)

# for_each applies first arg fun to the elements of xs
def for_each(fun, xs):
    if is_none(xs):
        return True
    else:
        fun(head(xs))
        return for_each(fun, tail(xs))

def _linked_list_to_string(xs, cont):
    if is_none(xs):
        return cont("None")
    elif is_pair(xs):
        return _linked_list_to_string(
            head(xs),
            lambda x: _linked_list_to_string(
                tail(xs),
                lambda y: cont("[" + str(x) + ", " + str(y) + "]")
            )
        )
    else:
        return cont(str(xs))

# linked_list_to_string returns a string that represents the argument linked_list
def linked_list_to_string(xs):
    return _linked_list_to_string(xs, lambda x: x)

def _reverse(original, reversed_linked_list):
    return reversed_linked_list if is_none(original) else _reverse(tail(original), pair(head(original), reversed_linked_list))

# reverse reverses the argument, assumed to be a linked_list
def reverse(xs):
    return _reverse(xs, None)

def _append(xs, ys, cont):
    return cont(ys) if is_none(xs) else _append(tail(xs), ys, lambda zs: cont(pair(head(xs), zs)))

# append first argument to the second argument
def append(xs, ys):
    return _append(xs, ys, lambda x: x)

# member looks for a given first-argument element in the second argument
def member(v, xs):
    if is_none(xs):
        return None
    elif v == head(xs):
        return xs
    else:
        return member(v, tail(xs))

def _remove(v, xs, acc):
    app = append
    rev = reverse
    if is_none(xs):
        return app(rev(acc), xs)
    elif v == head(xs):
        return app(rev(acc), tail(xs))
    else:
        return _remove(v, tail(xs), pair(head(xs), acc))

# removes the first occurrence of a given first-argument element
def remove(v, xs):
    return _remove(v, xs, None)

# Similar to remove, but removes all instances of v
def _remove_all(v, xs, acc):
    app = append
    rev = reverse
    if is_none(xs):
        return app(rev(acc), xs)
    elif v == head(xs):
        return _remove_all(v, tail(xs), acc)
    else:
        return _remove_all(v, tail(xs), pair(head(xs), acc))

def remove_all(v, xs):
    return _remove_all(v, xs, None)

def _filter_linked_list(pred, xs, acc):
    if is_none(xs):
        return reverse(acc)
    elif pred(head(xs)):
        return _filter_linked_list(pred, tail(xs), pair(head(xs), acc))
    else:
        return _filter_linked_list(pred, tail(xs), acc)

# filter_linked_list returns the linked list of elements from xs for which pred returns true
def filter_linked_list(pred, xs):
    return _filter_linked_list(pred, xs, None)

def _enum_linked_list(start, end, acc):
    rev = reverse
    return rev(acc) if start > end else _enum_linked_list(start + 1, end, pair(start, acc))

# enumerates numbers starting from start until end
def enum_linked_list(start, end):
    return _enum_linked_list(start, end, None)

# Returns the item in xs at index n
def linked_list_ref(xs, n):
    return head(xs) if n == 0 else linked_list_ref(tail(xs), n - 1)

def _accumulate_linked_list(f, initial, xs, cont):
    return cont(initial) if is_none(xs) else _accumulate_linked_list(f, initial, tail(xs), lambda x: cont(f(head(xs), x)))

# accumulate applies an operation op right-to-left
def accumulate_linked_list(f, initial, xs):
    return _accumulate_linked_list(f, initial, xs, lambda x: x)

`