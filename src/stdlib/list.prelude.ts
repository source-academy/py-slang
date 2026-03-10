export default `
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