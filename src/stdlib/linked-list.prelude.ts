export default `
def build_linked_list(f, n):
    """ test """
    if n == 0:
        return None
    else:
        return pair(f(n), build_linked_list(f, n - 1))
`