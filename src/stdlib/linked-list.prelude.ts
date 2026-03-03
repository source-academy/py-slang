export default `
# equal computes the structural equality over its arguments
def equal(xs, ys):
    if is_pair(xs):
        return (is_pair(ys) and 
                equal(head(xs), head(ys)) and 
                equal(tail(xs), tail(ys)))
    elif is_none(xs):
        return is_none(ys)
    elif is_number(xs):
        return is_number(ys) and xs == ys
    elif is_boolean(xs):
        return is_boolean(ys) and ((xs and ys) or (not xs and not ys))
    elif is_string(xs):
        return is_string(ys) and xs == ys
    elif is_function(xs):
        return is_function(ys) and xs == ys
    else:
        return False

# returns the length of a given argument list
def _length(xs, acc):
    return acc if is_null(xs) else _length(tail(xs), acc + 1)

def length(xs):
    return _length(xs, 0)

# map applies first arg f to the elements of the second argument xs
def _map(f, xs, acc):
    return reverse(acc) if is_null(xs) else _map(f, tail(xs), pair(f(head(xs)), acc))

def map(f, xs):
    return _map(f, xs, None)

# build_list takes a function fun and a nonnegative integer n
def _build_list(i, fun, already_built):
    return already_built if i < 0 else _build_list(i - 1, fun, pair(fun(i), already_built))

def build_list(fun, n):
    return _build_list(n - 1, fun, None)

# for_each applies first arg fun to the elements of xs
def for_each(fun, xs):
    if is_null(xs):
        return True
    else:
        fun(head(xs))
        return for_each(fun, tail(xs))

# list_to_string returns a string that represents the argument list
def _list_to_string(xs, cont):
    if is_null(xs):
        return cont("null")
    elif is_pair(xs):
        return _list_to_string(
            head(xs),
            lambda x: _list_to_string(
                tail(xs),
                lambda y: cont("[" + str(x) + ", " + str(y) + "]")
            )
        )
    else:
        return cont(stringify(xs))

def list_to_string(xs):
    return _list_to_string(xs, lambda x: x)

# reverse reverses the argument, assumed to be a list
def _reverse(original, reversed_list):
    return reversed_list if is_null(original) else _reverse(tail(original), pair(head(original), reversed_list))

def reverse(xs):
    return _reverse(xs, None)

# append first argument to the second argument
def _append(xs, ys, cont):
    return cont(ys) if is_null(xs) else _append(tail(xs), ys, lambda zs: cont(pair(head(xs), zs)))

def append(xs, ys):
    return _append(xs, ys, lambda x: x)

# member looks for a given first-argument element in the second argument
def member(v, xs):
    if is_null(xs):
        return None
    elif v == head(xs):
        return xs
    else:
        return member(v, tail(xs))

# removes the first occurrence of a given first-argument element
def _remove(v, xs, acc):
    app = append
    rev = reverse
    if is_null(xs):
        return app(rev(acc), xs)
    elif v == head(xs):
        return app(rev(acc), tail(xs))
    else:
        return _remove(v, tail(xs), pair(head(xs), acc))

def remove(v, xs):
    return _remove(v, xs, None)

# Similar to remove, but removes all instances of v
def _remove_all(v, xs, acc):
    app = append
    rev = reverse
    if is_null(xs):
        return app(rev(acc), xs)
    elif v == head(xs):
        return _remove_all(v, tail(xs), acc)
    else:
        return _remove_all(v, tail(xs), pair(head(xs), acc))

def remove_all(v, xs):
    return _remove_all(v, xs, None)

# filter returns the sublist of elements for which pred returns true
def _filter(pred, xs, acc):
    if is_null(xs):
        return reverse(acc)
    elif pred(head(xs)):
        return _filter(pred, tail(xs), pair(head(xs), acc))
    else:
        return _filter(pred, tail(xs), acc)

def filter(pred, xs):
    return _filter(pred, xs, None)

# enumerates numbers starting from start until end
def _enum_list(start, end, acc):
    rev = reverse
    return rev(acc) if start > end else _enum_list(start + 1, end, pair(start, acc))

def enum_list(start, end):
    return _enum_list(start, end, None)

# Returns the item in xs at index n
def list_ref(xs, n):
    return head(xs) if n == 0 else list_ref(tail(xs), n - 1)

# accumulate applies an operation op right-to-left
def _accumulate(f, initial, xs, cont):
    return cont(initial) if is_null(xs) else _accumulate(f, initial, tail(xs), lambda x: cont(f(head(xs), x)))

def accumulate(f, initial, xs):
    return _accumulate(f, initial, xs, lambda x: x)
`