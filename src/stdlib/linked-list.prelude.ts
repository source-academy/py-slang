export default `
def _build_linked_list(f, i, n):
    if i > n:
        return None
    else:
        return pair(f(i), _build_linked_list(f, i + 1, n))

def build_linked_list(f, n):
    return _build_linked_list(f, 1, n)
`