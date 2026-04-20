export default `
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
    elif is_list(xs):
        if not is_list(ys) or list_length(xs) != list_length(ys):
            return False
        i = 0
        while i < list_length(xs):
            if not equal(xs[i], ys[i]):
                return False
            i = i + 1
        return True
    else:
        return False

def build_list(fun, n):
    """
    build_list takes a function fun and a nonnegative integer n, and returns a list of length n where the i-th element is fun(i).
    """
    if n < 0:
        error("n must be a nonnegative integer")
    result = _gen_list(n)
    i = 0
    while i < n:
        result[i] = fun(i)
        i = i + 1
    return result
`;
